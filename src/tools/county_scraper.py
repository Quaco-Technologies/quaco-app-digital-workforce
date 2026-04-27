from __future__ import annotations

"""
County records scraper — Browserbase + Selenium + GPT-4o agent.
No Playwright. Selenium is synchronous; the public API wraps it in asyncio.to_thread.
"""

import asyncio
import json
import time
import urllib.parse
from typing import Any, Dict, List

from browserbase import Browserbase
from openai import OpenAI
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.remote_connection import RemoteConnection
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

_SYSTEM = """You are a web automation agent that extracts residential property records from county assessor / appraisal district websites.

## Your job
Find the county assessor website, search for properties, and extract structured records.

## Steps
1. Navigate to the county assessor website. If you know the URL, go directly. Otherwise search DuckDuckGo.
2. Accept any disclaimer or popup immediately.
3. Call get_inputs to discover all form fields, dropdowns, and buttons on the page.
4. IMPORTANT — set any Account Type / Property Type / Category filter to "RESIDENTIAL" before searching. Use the selector from get_inputs output. If there is a radio button or dropdown for property type, select RESIDENTIAL first.
5. Search with a broad street name (try "Main", then "Oak", then "Park") — leave all other fields empty except the residential filter.
6. Submit the form. After submission, call get_table_rows to read all result rows as structured JSON.
7. From the rows, collect only RESIDENTIAL properties with a real assessed/total value (skip rows where value < $10,000 or type is COMMERCIAL / BPP / LAND).
8. For each property record: capture address, city, state, APN (from detail link href), owner name, assessed value.
9. Paginate to page 2 if available and you still have fewer than 20 residential results.
10. If one street name returns nothing residential, try "Oak", then "Park".
11. Call save_leads with all collected records. Aim for 20–50.

## Rules
- ALWAYS call get_inputs before using any fill or click. Never guess selectors.
- If a page looks broken or empty, call screenshot to see what's there.
- Only collect RESIDENTIAL / SINGLE-FAMILY properties. Skip all COMMERCIAL, BPP, and LAND rows.
- Don't invent data. If a field isn't on the page, omit it.
- The APN/account number is usually embedded in the href of the property address link.

## Known county assessor URLs (go directly — skip DuckDuckGo)
- Dallas County TX    → https://www.dallascad.org/SearchAddr.aspx
- Tarrant County TX   → https://www.tad.org/
- Harris County TX    → https://hcad.org/property-search/real-property/
- Travis County TX    → https://travis.prodigycad.com/
- Fulton County GA    → https://qpublic.schneidercorp.com/Application.aspx?App=FultonCountyGA&PageType=Search
- Cook County IL      → https://www.cookcountyassessor.com/
- Maricopa County AZ  → https://mcassessor.maricopa.gov/
- LA County CA        → https://assessor.lacounty.gov/
- Miami-Dade FL       → https://www.miamidade.gov/Apps/PA/propertysearch/

For any county not listed above: search DuckDuckGo to find it."""

_TOOLS: List[Dict[str, Any]] = [
    {"type": "function", "function": {
        "name": "navigate", "description": "Go to a URL.",
        "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
    }},
    {"type": "function", "function": {
        "name": "click", "description": "Click an element by CSS selector or visible text.",
        "parameters": {"type": "object", "properties": {
            "selector": {"type": "string"}, "by_text": {"type": "boolean"},
        }, "required": ["selector"]},
    }},
    {"type": "function", "function": {
        "name": "fill", "description": "Type text into a form field. Uses JS fallback if direct fill fails.",
        "parameters": {"type": "object", "properties": {
            "selector": {"type": "string"}, "text": {"type": "string"}, "submit": {"type": "boolean"},
        }, "required": ["selector", "text"]},
    }},
    {"type": "function", "function": {
        "name": "get_page", "description": "Get current URL and first 8000 chars of visible page text.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_inputs", "description": "List all visible input fields, buttons, and links with their CSS selectors. Call this before fill/click.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_table_rows",
        "description": (
            "Return all visible table rows as a JSON array of arrays. Each inner array is one row's cell texts. "
            "Use this after a search to read result rows without parsing HTML."
        ),
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "screenshot", "description": "Capture a screenshot. Use when selectors fail or the page is unclear.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "save_leads", "description": "Save all extracted property records.",
        "parameters": {"type": "object", "properties": {
            "leads": {"type": "array", "items": {"type": "object", "properties": {
                "address": {"type": "string"}, "city": {"type": "string"}, "state": {"type": "string"},
                "zip": {"type": "string"}, "apn": {"type": "string"}, "owner_name": {"type": "string"},
                "owner_mailing_address": {"type": "string"}, "sqft": {"type": "integer"},
                "assessed_value": {"type": "integer"}, "improvement_value": {"type": "integer"},
                "bedrooms": {"type": "integer"}, "bathrooms": {"type": "number"},
                "year_built": {"type": "integer"}, "property_type": {"type": "string"},
            }, "required": ["address"]}},
        }, "required": ["leads"]},
    }},
]


class _BBRemoteConn(RemoteConnection):
    """Browserbase Selenium connection with auth header injection."""

    def __init__(self, remote_addr: str, api_key: str, session_id: str) -> None:
        super().__init__(remote_addr)
        self._bb_api_key = api_key
        self._bb_session_id = session_id

    def get_remote_connection_headers(self, parsed_url: Any, keep_alive: bool = False) -> Dict[str, str]:
        headers = super().get_remote_connection_headers(parsed_url, keep_alive)
        headers.update({"x-bb-api-key": self._bb_api_key, "session-id": self._bb_session_id})
        return headers


def _get_body_text(driver: webdriver.Remote) -> str:
    try:
        return driver.find_element(By.TAG_NAME, "body").text[:8000]
    except Exception:
        return ""


def _page_ctx(driver: webdriver.Remote) -> str:
    return f"URL: {driver.current_url}\n\nContent:\n{_get_body_text(driver)}"


def _scrape_sync(county: str, state: str, city: str) -> List[Dict[str, Any]]:
    """Run the GPT-4o + Selenium browser agent synchronously."""
    api_key = settings.browserbase_api_key
    project_id = settings.browserbase_project_id
    oai_key = settings.openai_api_key

    bb = Browserbase(api_key=api_key)
    session = bb.sessions.create(project_id=project_id, api_timeout=600)
    logger.info("county_scraper.session", session_id=session.id)

    conn = _BBRemoteConn(session.selenium_remote_url, api_key, session.id)
    options = webdriver.ChromeOptions()
    driver = webdriver.Remote(command_executor=conn, options=options)

    client = OpenAI(api_key=oai_key)
    extracted: List[Dict[str, Any]] = []

    # ── Tool implementations ──────────────────────────────────────────────────

    def _nav(url: str) -> str:
        driver.get(url)
        time.sleep(3)
        return _page_ctx(driver)

    def _click(selector: str, by_text: bool = False) -> str:
        try:
            if by_text:
                # Use json.dumps to safely encode the text for the XPath string
                safe_text = selector.replace("'", "\\'")
                el = driver.find_element(By.XPATH, f"//*[contains(normalize-space(text()), '{safe_text}')]")
                el.click()
            else:
                el = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
                el.click()
            time.sleep(3)
        except Exception as exc:
            logger.debug("county_scraper.click.miss", selector=selector, err=str(exc))
        return _page_ctx(driver)

    def _fill(selector: str, text: str, submit: bool = False) -> str:
        filled = False
        try:
            el = WebDriverWait(driver, 8).until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
            el.clear()
            el.send_keys(text)
            filled = True
        except Exception:
            pass

        if not filled:
            # Use json.dumps to safely encode selector and text — prevents JS syntax errors
            js_sel = json.dumps(selector)
            js_val = json.dumps(text)
            driver.execute_script(
                f"""var el=document.querySelector({js_sel});
                if(el){{el.value={js_val};
                el.dispatchEvent(new Event('input',{{bubbles:true}}));
                el.dispatchEvent(new Event('change',{{bubbles:true}}));}}"""
            )

        if submit:
            try:
                driver.find_element(By.CSS_SELECTOR, selector).send_keys(Keys.RETURN)
            except Exception:
                try:
                    driver.execute_script("document.querySelector('form').submit()")
                except Exception:
                    pass
            time.sleep(4)

        return _page_ctx(driver)

    def _get_inputs() -> str:
        try:
            elements = driver.execute_script("""
                var r=[];
                function labelFor(el) {
                    if (el.id) {
                        var lbl = document.querySelector('label[for="' + el.id + '"]');
                        if (lbl) return (lbl.textContent||'').trim().slice(0,40);
                    }
                    var parent = el.closest('label');
                    if (parent) return (parent.textContent||'').trim().replace(/\\s+/g,' ').slice(0,40);
                    return '';
                }
                function addEl(el) {
                    var rect=el.getBoundingClientRect();
                    if(rect.width>0&&rect.height>0){
                        var id=el.id?'#'+el.id:null;
                        var nm=el.name?'[name="'+el.name+'"]':null;
                        var lbl=labelFor(el);
                        r.push({tag:el.tagName.toLowerCase(),type:el.type||null,id:el.id||null,
                            name:el.name||null,placeholder:el.placeholder||null,label:lbl||null,
                            checked:(el.type==='checkbox'||el.type==='radio')?el.checked:undefined,
                            value:(el.value||el.textContent||'').trim().slice(0,60),
                            selector:id||nm||el.tagName.toLowerCase()});
                    }
                }
                document.querySelectorAll('input,select,textarea,button').forEach(addEl);
                document.querySelectorAll('a[href]').forEach(addEl);
                return r.slice(0,50);
            """)
            return json.dumps(elements, indent=2)
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def _get_table_rows() -> str:
        """Extract all visible table rows as JSON array of arrays."""
        try:
            rows = driver.execute_script("""
                var result = [];
                document.querySelectorAll('table tr').forEach(function(row) {
                    var cells = [];
                    row.querySelectorAll('td, th').forEach(function(cell) {
                        var a = cell.querySelector('a');
                        var href = a ? a.href : '';
                        var text = (cell.innerText || cell.textContent || '').trim().replace(/\\s+/g,' ');
                        cells.push({text: text, href: href});
                    });
                    if (cells.length > 0) result.push(cells);
                });
                return result.slice(0, 200);
            """)
            return json.dumps(rows[:200], ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    # ── Agent loop ────────────────────────────────────────────────────────────

    ddg = urllib.parse.quote(f"{county} County {state} property search assessor appraisal district")
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": (
            f"Extract residential property records for {county} County, {state} (city: {city}).\n"
            f"Find the county assessor website, search by street name, and collect all residential properties.\n"
            f"Start here if the county website is unknown: https://duckduckgo.com/?q={ddg}\n"
            f"Collect at least 20 records. Call save_leads when done."
        )},
    ]

    done = False
    try:
        for _ in range(22):
            if done:
                break

            response = client.chat.completions.create(
                model=settings.openai_model,
                tools=_TOOLS,  # type: ignore[arg-type]
                messages=messages,  # type: ignore[arg-type]
            )
            msg = response.choices[0].message

            if response.choices[0].finish_reason != "tool_calls" or not msg.tool_calls:
                break

            messages.append({
                "role": "assistant",
                "content": msg.content,
                "tool_calls": [
                    {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in msg.tool_calls
                ],
            })

            for tc in msg.tool_calls:
                name = tc.function.name
                try:
                    inp = json.loads(tc.function.arguments)
                except Exception:
                    inp = {}

                if name == "navigate":
                    result = _nav(inp.get("url", ""))
                elif name == "click":
                    result = _click(inp.get("selector", ""), inp.get("by_text", False))
                elif name == "fill":
                    result = _fill(inp.get("selector", ""), inp.get("text", ""), inp.get("submit", False))
                elif name == "get_page":
                    result = _page_ctx(driver)
                elif name == "get_inputs":
                    result = _get_inputs()
                elif name == "get_table_rows":
                    result = _get_table_rows()
                elif name == "screenshot":
                    b64 = driver.get_screenshot_as_base64()
                    messages.append({"role": "tool", "tool_call_id": tc.id, "content": "screenshot captured — see image below"})
                    messages.append({
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}},
                            {"type": "text", "text": "This is the current page. Identify the correct form fields and continue extracting records."},
                        ],
                    })
                    continue
                elif name == "save_leads":
                    extracted = inp.get("leads", [])
                    result = json.dumps({"saved": len(extracted)})
                    done = True
                else:
                    result = json.dumps({"error": f"unknown tool: {name}"})

                messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    logger.info("county_scraper.done", county=county, state=state, found=len(extracted))
    return extracted


async def scrape_county_records(county: str, state: str, city: str) -> List[Dict[str, Any]]:
    """Browserbase + Selenium + GPT-4o county records scraper (async wrapper)."""
    try:
        return await asyncio.to_thread(_scrape_sync, county, state, city)
    except Exception as exc:
        logger.error("county_scraper.error", county=county, state=state, error=str(exc))
        return []
