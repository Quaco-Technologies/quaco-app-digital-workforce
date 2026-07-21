-- BirdDog buy box persistence
--
-- Two concerns:
--   1. skip_trace_cache — a GLOBAL cache so we never pay Apify twice for the
--      same owner. Keyed by a normalized address. Written server-side with the
--      service role, so no anon policies are required.
--   2. saved_leads — per-investor saved results, so a search survives a refresh
--      and each investor builds up a lead database over time.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Global skip-trace cache
-- ---------------------------------------------------------------------------
create table if not exists skip_trace_cache (
    query_key   text primary key,             -- normalized "street; city, st zip"
    result      jsonb not null,               -- normalized SkipTraceResult
    has_phone   boolean not null default false,
    created_at  timestamptz not null default now()
);

create index if not exists skip_trace_cache_created_at on skip_trace_cache(created_at);

-- Server-only table: enable RLS with no policies, so anon/authenticated clients
-- can't touch it and only the service role (which bypasses RLS) can.
alter table skip_trace_cache enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Per-investor saved leads
-- ---------------------------------------------------------------------------
create table if not exists saved_leads (
    id            uuid primary key default uuid_generate_v4(),
    investor_id   uuid not null references auth.users(id) on delete cascade,
    -- property
    address       text not null,
    street        text,
    city          text,
    state         text,
    zip           text,
    price         integer,
    beds          integer,
    baths         numeric(4,1),
    sqft          integer,
    listing_url   text,
    img_src       text,
    -- buy box that produced it (for grouping / re-running)
    area          text,
    -- owner contact (denormalized snapshot at time of trace)
    owner_name    text,
    owner_age     text,
    owner_mailing text,
    phones        jsonb not null default '[]',
    emails        jsonb not null default '[]',
    status        text not null default 'new',
    created_at    timestamptz not null default now(),
    -- one row per property per investor; re-saving updates in place
    unique (investor_id, address)
);

create index if not exists saved_leads_investor on saved_leads(investor_id, created_at desc);

alter table saved_leads enable row level security;

-- Each investor sees and manages only their own leads.
drop policy if exists saved_leads_own_select on saved_leads;
create policy saved_leads_own_select on saved_leads
    for select using (auth.uid() = investor_id);

drop policy if exists saved_leads_own_insert on saved_leads;
create policy saved_leads_own_insert on saved_leads
    for insert with check (auth.uid() = investor_id);

drop policy if exists saved_leads_own_update on saved_leads;
create policy saved_leads_own_update on saved_leads
    for update using (auth.uid() = investor_id);

drop policy if exists saved_leads_own_delete on saved_leads;
create policy saved_leads_own_delete on saved_leads
    for delete using (auth.uid() = investor_id);
