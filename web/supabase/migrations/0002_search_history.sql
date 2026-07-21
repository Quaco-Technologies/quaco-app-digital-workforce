-- Search history: every buy box run a signed-in investor does is saved as a
-- "search" they can reopen later — same result cards, same CSV.

create extension if not exists "uuid-ossp";

create table if not exists saved_searches (
    id          uuid primary key default uuid_generate_v4(),
    investor_id uuid not null references auth.users(id) on delete cascade,
    area        text,
    params      jsonb not null default '{}',   -- price/beds/baths/limit used
    found       integer not null default 0,    -- matched the buy box
    traced      integer not null default 0,    -- owners examined
    lead_count  integer not null default 0,    -- callable leads returned
    created_at  timestamptz not null default now()
);

create index if not exists saved_searches_investor on saved_searches(investor_id, created_at desc);
alter table saved_searches enable row level security;

drop policy if exists saved_searches_own_select on saved_searches;
create policy saved_searches_own_select on saved_searches for select using (auth.uid() = investor_id);
drop policy if exists saved_searches_own_insert on saved_searches;
create policy saved_searches_own_insert on saved_searches for insert with check (auth.uid() = investor_id);
drop policy if exists saved_searches_own_delete on saved_searches;
create policy saved_searches_own_delete on saved_searches for delete using (auth.uid() = investor_id);

-- Leads now belong to a search. A property can legitimately appear in more than
-- one search, so the old per-address uniqueness is dropped. The full lead is
-- kept as jsonb so a reopened search renders byte-for-byte identically.
alter table saved_leads add column if not exists search_id uuid references saved_searches(id) on delete cascade;
alter table saved_leads add column if not exists lead jsonb;
alter table saved_leads drop constraint if exists saved_leads_investor_id_address_key;
create index if not exists saved_leads_search on saved_leads(search_id);
