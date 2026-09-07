-- Network Ledger — database schema for the standalone (Supabase) version.
--
-- Run this ONCE in the Supabase dashboard:
--   SQL Editor  ->  New query  ->  paste this whole file  ->  Run
-- Re-running it is safe (every statement is idempotent).

---------------------------------------------------------------------------
-- 1. Contacts table
---------------------------------------------------------------------------
create table if not exists public.contacts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  company        text not null default '',
  role           text not null default '',
  email          text not null default '',
  linkedin       text not null default '',
  phone          text not null default '',
  industry       text not null default '',
  location       text not null default '',
  how_met        text not null default '',
  stage          text not null default 'new',
  strength       text not null default '',
  tags           text[] not null default '{}',
  last_contact   date,
  next_follow_up date,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists contacts_user_id_idx on public.contacts (user_id);

---------------------------------------------------------------------------
-- 2. Keep updated_at fresh on every write
---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

---------------------------------------------------------------------------
-- 3. Row-Level Security — a user can only ever touch their own rows.
--    This is the security boundary. The browser only ever holds the
--    publishable "anon" key; these policies are what actually protect data.
---------------------------------------------------------------------------
alter table public.contacts enable row level security;

drop policy if exists contacts_select_own on public.contacts;
create policy contacts_select_own on public.contacts
  for select using (auth.uid() = user_id);

drop policy if exists contacts_insert_own on public.contacts;
create policy contacts_insert_own on public.contacts
  for insert with check (auth.uid() = user_id);

drop policy if exists contacts_update_own on public.contacts;
create policy contacts_update_own on public.contacts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists contacts_delete_own on public.contacts;
create policy contacts_delete_own on public.contacts
  for delete using (auth.uid() = user_id);

---------------------------------------------------------------------------
-- 4. Realtime — let the app receive live changes to its own rows.
--    (Safe to re-run: ignores "table is already member of publication".)
---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.contacts;
exception
  when duplicate_object then null;
end;
$$;

---------------------------------------------------------------------------
-- 5. "Delete all my data" helper — wipes only the caller's contacts.
--    security invoker => RLS still applies, so it can't touch anyone else.
---------------------------------------------------------------------------
create or replace function public.delete_my_contacts()
returns void
language sql
security invoker
as $$
  delete from public.contacts where user_id = auth.uid();
$$;
