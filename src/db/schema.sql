-- Digital Workforce — Supabase schema
-- Run once via Supabase SQL editor

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------
create table if not exists leads (
    id              uuid primary key default uuid_generate_v4(),
    source          text not null,
    address         text not null,
    city            text,
    state           text,
    zip             text,
    price           integer,
    bedrooms        integer,
    bathrooms       numeric(4,1),
    sqft            integer,
    listing_url     text,
    days_on_market  integer,
    description     text,
    status          text not null default 'new',
    investor_id     uuid references auth.users(id) on delete set null,
    buy_box_id      uuid,
    agreed_price    integer,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (address, source)
);

create index if not exists leads_investor_id on leads(investor_id);
create index if not exists leads_status on leads(status);

-- -----------------------------------------------------------------------
-- Contacts
-- -----------------------------------------------------------------------
create table if not exists contacts (
    id              uuid primary key default uuid_generate_v4(),
    lead_id         uuid not null references leads(id) on delete cascade,
    owner_name      text,
    phones          jsonb default '[]',
    emails          jsonb default '[]',
    mailing_address text,
    confidence      numeric(4,3) default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (lead_id)
);

-- -----------------------------------------------------------------------
-- Messages (SMS conversation log)
-- -----------------------------------------------------------------------
create table if not exists messages (
    id          uuid primary key default uuid_generate_v4(),
    lead_id     uuid not null references leads(id) on delete cascade,
    role        text not null check (role in ('agent', 'owner')),
    body        text not null,
    sent_at     timestamptz not null default now()
);

create index if not exists messages_lead_sent on messages(lead_id, sent_at);

-- -----------------------------------------------------------------------
-- Deals
-- -----------------------------------------------------------------------
create table if not exists deals (
    id              uuid primary key default uuid_generate_v4(),
    lead_id         uuid not null references leads(id) on delete cascade,
    arv             integer,
    repair_estimate integer,
    max_offer       integer,
    initial_offer   integer,
    deal_score      numeric(5,3),
    recommendation  text check (recommendation in ('pursue', 'watch', 'skip')),
    comps           jsonb default '[]',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (lead_id)
);

-- -----------------------------------------------------------------------
-- Contracts
-- -----------------------------------------------------------------------
create table if not exists contracts (
    id              uuid primary key default uuid_generate_v4(),
    lead_id         uuid not null references leads(id) on delete cascade,
    envelope_id     text not null,
    agreed_price    integer,
    status          text not null default 'sent' check (status in ('sent', 'completed', 'voided')),
    completed_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (lead_id),
    unique (envelope_id)
);

-- -----------------------------------------------------------------------
-- Row Level Security — investors only see their own data
-- -----------------------------------------------------------------------
alter table leads enable row level security;
alter table contacts enable row level security;
alter table messages enable row level security;
alter table deals enable row level security;
alter table contracts enable row level security;

create policy "investor_own_leads" on leads
    using (investor_id = auth.uid());

create policy "investor_own_contacts" on contacts
    using (lead_id in (select id from leads where investor_id = auth.uid()));

create policy "investor_own_messages" on messages
    using (lead_id in (select id from leads where investor_id = auth.uid()));

create policy "investor_own_deals" on deals
    using (lead_id in (select id from leads where investor_id = auth.uid()));

create policy "investor_own_contracts" on contracts
    using (lead_id in (select id from leads where investor_id = auth.uid()));
