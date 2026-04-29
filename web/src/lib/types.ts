export type LeadStatus =
  | "new"
  | "skip_traced"
  | "enriched"
  | "analyzed"
  | "outreach"
  | "negotiating"
  | "under_contract"
  | "dead"
  | "closed";

export type PipelineRecommendation = "pursue" | "needs_review" | "skip";
export type DealRecommendation = "pursue" | "watch" | "skip";
export type ContractStatus = "sent" | "completed" | "voided";
export type MessageRole = "agent" | "owner";

export interface Lead {
  id: string;
  source: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  listing_url: string | null;
  days_on_market: number | null;
  description: string | null;
  status: LeadStatus;
  investor_id: string | null;
  agreed_price: number | null;
  created_at: string;
  updated_at: string;

  // County record fields
  apn: string | null;
  owner_name: string | null;
  assessed_value: number | null;
  year_built: number | null;

  // FEMA flood zone
  flood_zone: string | null;
  flood_risk_high: boolean | null;

  // Photo analysis
  photo_condition: string | null;
  photo_confidence: number | null;
  investment_type: string | null;

  // Comps + offer
  comps: Record<string, unknown>[] | null;
  arv: number | null;
  offer_price: number | null;
  repair_estimate: number | null;
  repair_breakdown: Record<string, number | null> | null;
  pipeline_recommendation: PipelineRecommendation | null;
  review_reasons: string[] | null;

  // Photos
  photos: string[] | null;
}

export interface Contact {
  id: string;
  lead_id: string;
  owner_name: string | null;
  phones: string[];
  emails: string[];
  mailing_address: string | null;
  confidence: number;
}

export interface Deal {
  id: string;
  lead_id: string;
  arv: number | null;
  repair_estimate: number | null;
  max_offer: number | null;
  initial_offer: number | null;
  deal_score: number | null;
  recommendation: DealRecommendation | null;
  comps: Record<string, unknown>[];
}

export interface Message {
  id: string;
  lead_id: string;
  role: MessageRole;
  body: string;
  sent_at: string;
}

export interface Contract {
  id: string;
  lead_id: string;
  envelope_id: string;
  agreed_price: number | null;
  status: ContractStatus;
  completed_at: string | null;
}

export interface LeadDetail {
  lead: Lead;
  deal: Deal | null;
  contact: Contact | null;
  conversation: Message[];
}

export interface DemoStage {
  name: string;
  label: string;
  status: "pending" | "running" | "complete";
  detail: string;
  started_at: number | null;
  completed_at: number | null;
}

export interface DemoSms {
  ts: number;
  kind: string;
  body: string;
  to: string;
  delivered: boolean;
  error: string | null;
}

export interface DemoState {
  demo_id: string;
  started_at: number;
  recipient_phone: string;
  stages: DemoStage[];
  sms_sent: DemoSms[];
  contract_url: string | null;
  is_complete: boolean;
}

export interface InboxThread {
  lead_id: string;
  address: string;
  city: string | null;
  state: string | null;
  owner_name: string | null;
  last_body: string;
  last_role: MessageRole;
  last_sent_at: string;
  message_count: number;
  has_unread_reply: boolean;
  lead_status: LeadStatus;
}

export interface EnrichedLead {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  price: number | null;
  bedrooms: number | null;
  sqft: number | null;
  arv: number | null;
  offer_price: number | null;
  pipeline_recommendation: PipelineRecommendation | null;
  owner_name: string | null;
  phones: string[];
  emails: string[];
  confidence: number;
  created_at: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  county: string | null;
  state: string | null;
  city: string | null;
  min_price: number | null;
  max_price: number | null;
  property_types: string[] | null;
  status: "running" | "complete";
  scraped_count: number;
  qualified_count: number;
  saved_count: number;
  created_at: string | null;
}

export interface CampaignLead {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  owner_name: string | null;
  assessed_value: number | null;
  arv: number | null;
  offer_price: number | null;
  repair_estimate: number | null;
  pipeline_recommendation: PipelineRecommendation | null;
  photo_condition: string | null;
  investment_type: string | null;
  photos: string[];
  status: LeadStatus;
  outreach_status: "contacted" | null;
  phones: string[];
  emails: string[];
  contact_confidence: number;
  created_at: string | null;
}

export interface InvestorProfile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  investor_type: "fix_flip" | "buy_hold" | "wholesale" | "new" | null;
  primary_state: string | null;
  target_markets: string | null;
  typical_min_price: number | null;
  typical_max_price: number | null;
  typical_property_types: string[];
  experience_level: "new" | "emerging" | "experienced" | "veteran" | null;
  monthly_deal_target: number | null;
  referral_source: string | null;
  onboarding_completed: boolean;
}

export interface BuyBox {
  city: string;
  state: string;
  county: string;
  min_price: number;
  max_price: number;
  property_types: string[];
  min_beds: number;
}

export interface PipelineStats {
  total: number;
  by_status: Partial<Record<LeadStatus, number>>;
  deals_analyzed: number;
  outreach_sent: number;
  under_contract: number;
  closed: number;
}
