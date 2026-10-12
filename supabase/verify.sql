-- The site's only real lock is row-level security: the app code is public, so anyone can call the API with the
-- publishable key. A rule that drifts to "any signed-in user" lets every Google account read Tofugu's worksheets
-- and audio, and nothing in the browser would show it [a weakened bucket rule let the stranger below see all 113 files].
-- Run after any change to setup.sql with `npm run verify-db`. Everything is rolled back.
\set ON_ERROR_ROLLBACK on
\pset tuples_only on
begin;
-- Made-up accounts, listed only inside this transaction, so real sign-ins never collide with them [your own address is taken once you sign in].
\set listed 'listed@example.com'
insert into public.allowed_emails values (:'listed');
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', :'listed', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'stranger@example.com', 'authenticated', 'authenticated');
insert into public.progress (user_id, data) values ('22222222-2222-2222-2222-222222222222', '{"stranger": true}');

\echo '== listed account: expect true, every content file, only its own row, no access list'
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', upper(:'listed'), 'role', 'authenticated')::text, true);
select 'is_allowed: ' || public.is_allowed();
select 'content files visible: ' || count(*) from storage.objects where bucket_id = 'content';
insert into public.progress (user_id, data) values ('11111111-1111-1111-1111-111111111111', '{"mine": true}');
select 'progress rows visible: ' || count(*) from public.progress;
update public.progress set data = '{"hacked": true}' where user_id = '22222222-2222-2222-2222-222222222222';
select count(*) from public.allowed_emails;
-- The deployed site saves `data` alone, so a tab on old code must leave the vocabulary deck in `study` alone [upsert of data only].
update public.progress set study = '{"cards": {"会う|あう#r": 1}}' where user_id = '11111111-1111-1111-1111-111111111111';
insert into public.progress (user_id, data, updated_at) values ('11111111-1111-1111-1111-111111111111', '{"old": true}', now())
  on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;
select 'study after a data-only save: ' || study::text from public.progress where user_id = '11111111-1111-1111-1111-111111111111';

\echo '== stranger: expect false, 0 files, 0 rows, and all three writes refused'
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"stranger@example.com","role":"authenticated"}', true);
select 'is_allowed: ' || public.is_allowed();
select 'content files visible: ' || count(*) from storage.objects where bucket_id = 'content';
select 'progress rows visible: ' || count(*) from public.progress;
insert into public.progress (user_id, data) values ('22222222-2222-2222-2222-222222222222', '{"try": 1}')
  on conflict (user_id) do update set data = excluded.data;
insert into public.allowed_emails values ('stranger@example.com');
update public.progress set study = '{"hacked": true}' where user_id = '11111111-1111-1111-1111-111111111111';

reset role;
\echo '== expect the stranger row unchanged, and the listed deck still its own'
select 'stranger row: ' || data::text from public.progress where user_id = '22222222-2222-2222-2222-222222222222';
select 'listed study: ' || study::text from public.progress where user_id = '11111111-1111-1111-1111-111111111111';
rollback;
