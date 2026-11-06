-- Nitin Singh portfolio: public reads, single-owner writes.
-- IMPORTANT: replace YOUR_VERIFIED_OWNER_EMAIL with the exact verified Supabase Auth email.
-- The portfolio payload is public by design. Never store passwords, private notes, API keys,
-- GitHub tokens, service-role keys, or other secrets in this table.

create table if not exists public.portfolio_state (
  id text primary key check (id = 'main'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_state enable row level security;

-- Start from no table privileges, then grant only the actions needed by the website.
revoke all on public.portfolio_state from anon, authenticated;

-- Visitors can read the one published public portfolio row.
grant select on public.portfolio_state to anon, authenticated;

-- Only authenticated users can attempt writes. RLS narrows this to one email + its auth.uid().
grant insert, update on public.portfolio_state to authenticated;

drop policy if exists "Public can read published portfolio" on public.portfolio_state;
drop policy if exists "Portfolio owner can create published portfolio" on public.portfolio_state;
drop policy if exists "Portfolio owner can update published portfolio" on public.portfolio_state;

create policy "Public can read published portfolio"
on public.portfolio_state for select
to anon, authenticated
using (id = 'main');

create policy "Portfolio owner can create published portfolio"
on public.portfolio_state for insert
to authenticated
with check (
  id = 'main'
  and auth.uid() = owner_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('YOUR_VERIFIED_OWNER_EMAIL')
);

create policy "Portfolio owner can update published portfolio"
on public.portfolio_state for update
to authenticated
using (
  id = 'main'
  and auth.uid() = owner_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('YOUR_VERIFIED_OWNER_EMAIL')
)
with check (
  id = 'main'
  and auth.uid() = owner_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('YOUR_VERIFIED_OWNER_EMAIL')
);

-- Keep the portfolio's public page live for visitors who already have it open.
do $$
begin
  alter publication supabase_realtime add table public.portfolio_state;
exception
  when duplicate_object then null;
end $$;
