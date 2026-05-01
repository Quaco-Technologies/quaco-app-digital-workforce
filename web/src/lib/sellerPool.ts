// Procedural pool of fake seller conversations. Combinatorial enough that
// the Network Activity feed never repeats during a demo session.

const FIRST_NAMES = [
  "Maria", "James", "Linda", "Marcus", "Tasha", "Robert", "Devon", "Sofia",
  "Aaron", "Olivia", "Carlos", "Naomi", "Yusuf", "Priya", "Greta", "Hassan",
  "Imani", "Beatrice", "Wilson", "Emma", "Caleb", "Ramona", "Felix", "Quinn",
  "Sasha", "Theo", "Vivian", "Nadia", "Reza", "Bianca", "Otis", "Lila",
];
const LAST_INITIALS = ["A","B","C","D","F","G","H","J","K","L","M","N","P","R","S","T","V","W","Y","Z"];
const STREETS = [
  "N High St", "Maple Ridge Dr", "Oak Lane", "Bayview Ave", "W Pine St",
  "Sunset Blvd", "Cedar Court", "Lakeshore Dr", "Hillview Rd", "Riverside Pl",
  "Elm Way", "Bay Pl", "Birch Ave", "Magnolia Ct", "Sycamore Ln",
  "Fern Hollow Rd", "Crestview Dr", "Park Ridge Ave", "King St", "Queen Blvd",
  "River Rd", "Forest Hill Ln", "Brook St", "Meadow Way", "Dogwood Dr",
];
const MARKETS: Array<{ city: string; state: string }> = [
  { city: "Atlanta",   state: "GA" }, { city: "Dallas",    state: "TX" },
  { city: "Tampa",     state: "FL" }, { city: "Phoenix",   state: "AZ" },
  { city: "Charlotte", state: "NC" }, { city: "Houston",   state: "TX" },
  { city: "Memphis",   state: "TN" }, { city: "Birmingham",state: "AL" },
  { city: "Raleigh",   state: "NC" }, { city: "Nashville", state: "TN" },
  { city: "Jacksonville", state: "FL" }, { city: "San Antonio", state: "TX" },
];

// 5 archetypes — each plays out a different journey so the panel feels varied.
type Stage = "opening" | "negotiating" | "agreed" | "signed" | "dead";
export type Outcome = "agreed" | "dead";

export interface Turn { role: "agent" | "owner"; body: string; }

export interface Seller {
  id: string;
  owner: string;            // "Maria H."
  city: string;
  state: string;
  address: string;          // "3857 N High St"
  initialOffer: number;
  agreedPrice?: number;     // set if outcome === "agreed"
  outcome: Outcome;         // determined at spawn time so metrics are deterministic
  script: Turn[];
}

let _id = 0;
function rng(max: number) { return Math.floor(Math.random() * max); }
function pick<T>(arr: T[]): T { return arr[rng(arr.length)]; }

export function spawnSeller(): Seller {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_INITIALS);
  const owner = `${first} ${last}.`;
  const market = pick(MARKETS);
  const number = 100 + rng(9899);
  const address = `${number} ${pick(STREETS)}`;
  const arv = (140 + rng(220)) * 1000;            // 140k–360k
  const initialOffer = Math.round(arv * 0.7);
  // Realistic distribution: 18% dead, 32% reach agreed, 50% mid-negotiation
  // (caller decides whether mid-negotiation cards finish in time)
  const r = Math.random();
  const outcome: Outcome = r < 0.30 ? "dead" : "agreed";
  const stretch = Math.round(initialOffer * (1.04 + Math.random() * 0.08));
  const agreedPrice = outcome === "agreed" ? stretch : undefined;

  const script: Turn[] = [];
  if (outcome === "dead") {
    script.push({ role: "agent", body: `Hi ${first}, I'm a local cash buyer — would you ever consider an offer on ${address}?` });
    script.push({ role: "owner", body: pick([
      "Not interested right now, thanks.",
      "Sorry, not selling.",
      "We just refinanced. No.",
      "Maybe in a year. Not now.",
    ]) });
    script.push({ role: "agent", body: pick([
      "No problem — if anything changes, I'm here.",
      "Totally understand. Have a good one.",
    ]) });
  } else {
    script.push({ role: "agent", body: `Hi ${first}, I'm a local cash buyer — would you ever consider an offer on ${address}?` });
    script.push({ role: "owner", body: pick([
      "Maybe. What kind of number are we talking?",
      "Send me the offer in writing.",
      "What's your timeline?",
      "How fast can you close?",
    ]) });
    script.push({ role: "agent", body: `I can do $${initialOffer.toLocaleString()} cash, as-is, close in 14 days.` });
    if (Math.random() > 0.4) {
      script.push({ role: "owner", body: pick([
        `Could you do $${(stretch + 5000).toLocaleString()}?`,
        "I was hoping for more.",
        "That's a bit low for me.",
      ]) });
      script.push({ role: "agent", body: `I can stretch to $${stretch!.toLocaleString()}. That's my best.` });
    }
    script.push({ role: "owner", body: pick([
      "Deal. Send the paperwork.",
      "OK, let's do it.",
      "Sounds good. What's next?",
      "Yes — I'm in.",
    ]) });
    script.push({ role: "agent", body: pick([
      "Awesome. Sending the contract now.",
      "Great. What's the best email for paperwork?",
    ]) });
  }

  return {
    id: `s-${_id++}`,
    owner, city: market.city, state: market.state, address,
    initialOffer, agreedPrice, outcome, script,
  };
}

export type { Stage };
