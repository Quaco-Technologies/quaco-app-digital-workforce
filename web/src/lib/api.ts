import { BuyBox, Campaign, CampaignLead, DemoState, EnrichedLead, InboxThread, InvestorProfile, Lead, LeadDetail, LeadStatus, Message } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = error.detail;
    const message = Array.isArray(detail)
      ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join(", ")
      : (detail ?? "Request failed");
    throw new Error(message);
  }

  return res.json();
}

export const api = {
  campaigns: {
    list: () => request<Campaign[]>("/campaigns"),
    leads: (campaignId: string) => request<CampaignLead[]>(`/campaigns/${campaignId}/leads`),
  },

  leads: {
    list: (status?: LeadStatus, limit = 50) =>
      request<Lead[]>(
        `/leads?limit=${limit}${status ? `&status=${status}` : ""}`
      ),
    listEnriched: () => request<EnrichedLead[]>("/leads/enriched"),
    get: (id: string) => request<LeadDetail>(`/leads/${id}`),
    updateStatus: (id: string, status: LeadStatus) =>
      request<{ id: string; status: string }>(`/leads/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),

    exportCsv: async (status?: LeadStatus) => {
      const token = await getToken();
      const url = `${BASE}/leads/export.csv${status ? `?status=${status}` : ""}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "leads.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    },
  },

  pipeline: {
    run: (buyBox: BuyBox) =>
      request<{ status: string; job_id: string | null }>("/pipeline/run", {
        method: "POST",
        body: JSON.stringify(buyBox),
      }),

    status: (jobId: string) =>
      request<{ status: string; result: Record<string, unknown> | null }>(
        `/pipeline/status/${jobId}`
      ),

    contract: (
      leadId: string,
      agreedPrice: number,
      investor: { name: string; email: string }
    ) =>
      request<{ status: string }>(`/pipeline/contract/${leadId}`, {
        method: "POST",
        body: JSON.stringify({
          agreed_price: agreedPrice,
          investor_name: investor.name,
          investor_email: investor.email,
        }),
      }),
  },

  inbox: {
    list: () => request<InboxThread[]>("/inbox"),
    reply: (leadId: string, body: string) =>
      request<{ message_id: string; message: Message }>(`/inbox/${leadId}/reply`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
  },

  insights: {
    activity: () => request<{ headline: string; body: string; confidence: string }>("/insights/activity"),
    chat: (history: Array<{ role: "user" | "assistant"; content: string }>) =>
      request<{ reply: string }>("/insights/chat", {
        method: "POST",
        body: JSON.stringify({ history }),
      }),
  },

  demo: {
    start: (recipient_phone?: string) =>
      request<{ demo_id: string; recipient_phone: string; message: string }>("/demo/start", {
        method: "POST",
        body: JSON.stringify({ recipient_phone }),
      }),
    status: (demoId: string) => request<DemoState>(`/demo/status/${demoId}`),
    negotiate: (body: {
      recipient_phone?: string; additional_phones?: string[]; owner_name?: string;
      address?: string; city?: string; state?: string;
      arv?: number; offer_price?: number;
    }) => request<{
      lead_id: string; recipient_phone: string; sent: boolean;
      opening_message: string; error: string | null;
      additional_lead_ids: string[] | null;
    }>("/demo/negotiate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    conversation: (leadId: string) => request<{
      lead_id: string; status: string; agreed_price: number | null;
      messages: Array<{ role: "agent" | "owner"; body: string; sent_at: string }>;
      contract_email_sent_to: string | null;
      contract_email_delivered: boolean;
      contract_url: string | null;
      contract_signed: boolean;
      signed_at: string | null;
    }>(`/demo/conversation/${leadId}`),
    simulateReply: (leadId: string, body: string) => request<{
      lead_id: string; status: string; agreed_price: number | null;
      messages: Array<{ role: "agent" | "owner"; body: string; sent_at: string }>;
      contract_email_sent_to: string | null;
      contract_email_delivered: boolean;
      contract_url: string | null;
      contract_signed: boolean;
      signed_at: string | null;
    }>(`/demo/conversation/${leadId}/simulate_reply`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
    signContract: (leadId: string) =>
      fetch(`${BASE}/demo/contract/${leadId}/sign`, { method: "POST" })
        .then((r) => r.json() as Promise<{ lead_id: string; signed: boolean; signed_at: string }>),
  },

  outreach: {
    launch: (campaignId: string, leadIds: string[], messageTemplate: string) =>
      request<{ sent: number; skipped: number; results: { lead_id: string; phone: string; status: string; error?: string }[] }>("/outreach/launch", {
        method: "POST",
        body: JSON.stringify({ campaign_id: campaignId, lead_ids: leadIds, message_template: messageTemplate }),
      }),
    stats: (campaignId: string) =>
      request<{ total: number; sent: number; failed: number }>(`/outreach/campaign/${campaignId}/stats`),
  },

  onboarding: {
    validateInvite: (code: string) =>
      request<{ valid: boolean }>("/onboarding/validate-invite", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    useInvite: (code: string) =>
      request<{ ok: boolean }>("/onboarding/use-invite", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    getProfile: () => request<InvestorProfile | null>("/onboarding/profile"),
    saveProfile: (profile: Partial<InvestorProfile> & { onboarding_completed: boolean }) =>
      request<{ ok: boolean }>("/onboarding/profile", {
        method: "POST",
        body: JSON.stringify(profile),
      }),
  },

  health: () => request<{ status: string }>("/health"),
};
