\set ON_ERROR_STOP off
begin;
select pg_sleep(0.05);
select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000002","email":"t119conc-site-manager@example.test"}',
  true
);
set local role authenticated;
select public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation'));
select public.delegate_suggestion_approval(
  (select id from private._t119_conc_ids where key = 'suggestion'),
  (select id from private._t119_conc_ids where key = 'alternate_delegate_membership'),
  'race session B'
);
commit;
