begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- Setup organisation and suggestion for feedback + notification tests
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'e2100000-0000-0000-0000-000000000001',
  's2d-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table s2d_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on s2d_ids to authenticated, lean_hub_private_owner, service_role;

insert into s2d_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'e2100000-0000-0000-0000-000000000001',
    's2d-org',
    'S2d Feedback Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'e2200000-0000-0000-0000-000000000001',
  'e2100000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e2100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2200000-0000-0000-0000-000000000001","email":"s2d-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2d_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into s2d_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from s2d_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into s2d_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into s2d_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2d_ids where key = 'organisation')
  and membership_row.user_id = 'e2100000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from s2d_ids where key = 'owner_membership'),
    (select id from s2d_ids where key = 'job_function'),
    true,
    (select id from s2d_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into s2d_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into s2d_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2d_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2d_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into s2d_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into s2d_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from s2d_ids where key = 'programme_version'),
  (select id from s2d_ids where key = 'category'),
  'S2d feedback suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(public.submit_suggestion((select id from s2d_ids where key = 'suggestion')), 'suggestion submits');
select ok(
  public.claim_suggestion_for_review((select id from s2d_ids where key = 'suggestion')) is not null,
  'reviewer claim succeeds'
);
select ok(
  public.begin_suggestion_review((select id from s2d_ids where key = 'suggestion')),
  'review begins'
);

-- ---------------------------------------------------------------------------
-- Employee feedback validation
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.approve_suggestion(
    (select id from s2d_ids where key = 'suggestion'),
    'medium',
    'medium',
    'Internal approval notes',
    null::text
  )$$,
  '22023',
  'employee feedback is required for this decision',
  'approve without employee feedback is rejected'
);

select ok(
  public.approve_suggestion(
    (select id from s2d_ids where key = 'suggestion'),
    'medium',
    'medium',
    'Internal approval notes',
    'Approved — please proceed with the improvement.'
  ) is not null,
  'approve stores employee feedback'
);

select is(
  (
    select review_row.employee_feedback
    from public.suggestion_reviews review_row
    order by review_row.review_date desc
    limit 1
  ),
  'Approved — please proceed with the improvement.',
  'employee feedback persisted separately from rationale'
);

-- ---------------------------------------------------------------------------
-- Delivery-time lookup + cross-org protection
-- ---------------------------------------------------------------------------

reset role;
set local role lean_hub_private_owner;

insert into s2d_ids (key, id)
select 'accepted_event', outbox_row.id
from private.domain_event_outbox outbox_row
where outbox_row.organisation_id = (select id from s2d_ids where key = 'organisation')
  and outbox_row.event_type = 'SuggestionAccepted'
order by outbox_row.created_at desc
limit 1;

insert into s2d_ids (key, id)
select
  'approved_delivery',
  private.create_notification_delivery(
    (select id from s2d_ids where key = 'organisation'),
    (select id from s2d_ids where key = 'accepted_event'),
    (select id from s2d_ids where key = 'owner_membership'),
    'suggestions.approved',
    's2d-approved-delivery-key'
  );

reset role;
set local role service_role;

select ok(
  (
    select context_row.context_employee_message
    from public.get_notification_delivery_context_for_worker(
      (select id from s2d_ids where key = 'organisation'),
      (select id from s2d_ids where key = 'approved_delivery'),
      (select id from s2d_ids where key = 'accepted_event')
    ) context_row
    limit 1
  ) = 'Approved — please proceed with the improvement.',
  'delivery context resolves employee feedback from canonical review record'
);

set local role postgres;

select is(
  private.lookup_suggestion_review_employee_feedback(
    (select id from s2d_ids where key = 'organisation'),
    (select id from s2d_ids where key = 'suggestion'),
    '00000000-0000-0000-0000-000000000099',
    'accept'
  ),
  null,
  'wrong review id fails closed'
);

-- ---------------------------------------------------------------------------
-- Implementation outcome
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"e2100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2200000-0000-0000-0000-000000000001","email":"s2d-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.begin_suggestion_implementation((select id from s2d_ids where key = 'suggestion')),
  'accepted suggestion can begin implementation'
);

select throws_ok(
  $$select public.mark_suggestion_implemented(
    (select id from s2d_ids where key = 'suggestion'),
    'Internal implementation summary',
    'implemented_as_proposed',
    null,
    null
  )$$,
  '22023',
  'employee outcome is required when marking implemented',
  'implemented transition requires employee outcome'
);

select ok(
  public.mark_suggestion_implemented(
    (select id from s2d_ids where key = 'suggestion'),
    'Internal implementation summary',
    'implemented_as_proposed',
    null,
    'The improvement is now live on the shop floor.'
  ),
  'implemented transition stores employee outcome'
);

reset role;
set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionImplemented'
  ),
  'implemented transition emits SuggestionImplemented domain event'
);

reset role;
set local role postgres;

select is(
  private.lookup_suggestion_employee_outcome(
    (select id from s2d_ids where key = 'organisation'),
    (select id from s2d_ids where key = 'suggestion')
  ),
  'The improvement is now live on the shop floor.',
  'employee outcome lookup succeeds for implemented suggestion'
);

select is(
  private.lookup_suggestion_employee_outcome(
    '00000000-0000-0000-0000-000000000099',
    (select id from s2d_ids where key = 'suggestion')
  ),
  null,
  'wrong organisation id fails closed for employee outcome lookup'
);

select * from finish();
rollback;
