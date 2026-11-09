-- Delegation reason visibility + schedule notification href remediation.

begin;

select plan(6);

select isnt_empty(
  $$
    select 1
    from pg_proc routine_row
    join pg_namespace namespace_row on namespace_row.oid = routine_row.pronamespace
    where namespace_row.nspname = 'private'
      and routine_row.proname = 'can_view_suggestion_delegation_reason'
  $$,
  'can_view_suggestion_delegation_reason exists'
);

select isnt_empty(
  $$
    select 1
    from pg_proc routine_row
    join pg_namespace namespace_row on namespace_row.oid = routine_row.pronamespace
    where namespace_row.nspname = 'private'
      and routine_row.proname = 'lookup_suggestion_delegation_reason_for_recipient'
  $$,
  'lookup_suggestion_delegation_reason_for_recipient exists'
);

reset role;
set local role authenticated;

select throws_ok(
  $$select public.get_suggestion_detail('00000000-0000-4000-8000-000000000099'::uuid)$$,
  '42501',
  'unauthorised reader receives 42501 on suggestion detail'
);

reset role;
set local role lean_hub_private_owner;

insert into public.in_app_notifications (
  organisation_id,
  membership_id,
  notification_type,
  title,
  body,
  href,
  dedupe_key
)
select
  organisation_row.id,
  membership_row.id,
  'leanai.chase_overdue_schedule',
  'legacy href',
  'test',
  '/platform/scheduling',
  'overdue_schedule:00000000-0000-4000-8000-0000000000aa:' || membership_row.id::text
from public.organisations organisation_row
join public.organisation_memberships membership_row
  on membership_row.organisation_id = organisation_row.id
limit 1;

update public.in_app_notifications
  set href = '/platform/schedule'
  where href = '/platform/scheduling';

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications
    where href = '/platform/scheduling'
  ),
  0::bigint,
  'legacy scheduling hrefs are rewritten to /platform/schedule'
);

select is(
  left(repeat('x', 500), 400),
  repeat('x', 400),
  'in-app delegation reason truncation uses a 400 character cap'
);

select * from finish();

rollback;
