-- One-time setup for the Hiragana site. Paste into Supabase → SQL Editor, put your Google address on the last line, run.

-- Who may use the site; nobody can read or change this through the API, only here in the SQL editor.
create table if not exists public.allowed_emails (email text primary key);
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

-- True when the signed-in account is on the list [security definer, so it can read the locked table above].
create or replace function public.is_allowed() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.allowed_emails where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
revoke execute on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

-- One row of progress per account, readable and writable only by its owner.
create table if not exists public.progress (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
revoke all on public.progress from anon;
grant select, insert, update on public.progress to authenticated;
drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (user_id = (select auth.uid()) and (select public.is_allowed()));

-- Private bucket for the Tofugu worksheets and audio; only listed accounts can read it.
insert into storage.buckets (id, name, public) values ('content', 'content', false)
on conflict (id) do update set public = false;
drop policy if exists "listed accounts read content" on storage.objects;
create policy "listed accounts read content" on storage.objects for select to authenticated
  using (bucket_id = 'content' and (select public.is_allowed()));

insert into public.allowed_emails (email) values ('YOUR-ADDRESS@gmail.com') on conflict do nothing;
