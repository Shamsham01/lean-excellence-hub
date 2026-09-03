begin;

select plan(15);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'd3000000-0000-0000-0000-000000000001',
  's2c-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table s2c_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on s2c_ids to authenticated, service_role, lean_hub_private_owner;

insert into s2c_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd3000000-0000-0000-0000-000000000001',
    's2c-notification-org',
    'S2c Notification Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'd3100000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2c-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2c_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into s2c_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from s2c_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into s2c_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into s2c_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2c_ids where key = 'organisation')
  and membership_row.user_id = 'd3000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from s2c_ids where key = 'owner_membership'),
    (select id from s2c_ids where key = 'job_function'),
    true,
    (select id from s2c_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into s2c_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into s2c_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2c_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2c_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into s2c_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into s2c_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from s2c_ids where key = 'programme_version'),
  (select id from s2c_ids where key = 'category'),
  'Reduce changeover time',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2c_ids where key = 'suggestion')),
  'suggestion submits'
);

reset role;
set local role lean_hub_private_owner;

select ok(
  private.membership_can_read_improvement_suggestion(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    (select id from s2c_ids where key = 'owner_membership')
  ),
  'membership_can_read grants author access'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2c-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2c_ids where key = 'organisation')),
  'owner re-selects organisation for workflow actions'
);

select ok(
  private.can_read_improvement_suggestion(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion')
  ),
  'can_read grants author access for current membership'
);

select ok(
  private.assign_suggestion_reviewer(
    (select id from s2c_ids where key = 'suggestion'),
    (select id from s2c_ids where key = 'owner_membership')
  ) is not null,
  'owner assigned as reviewer'
);

reset role;
set local role lean_hub_private_owner;

insert into s2c_ids (key, id)
select
  'assigned_event',
  private.enqueue_domain_event(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    'SuggestionReviewerAssigned',
    's2c-assigned-event',
    jsonb_build_object(
      'reviewer_membership_id',
      (select id::text from s2c_ids where key = 'owner_membership')
    )
  );

insert into s2c_ids (key, id)
select
  'assigned_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'assigned_event'),
    (select id from s2c_ids where key = 'owner_membership'),
    'suggestions.reviewer_assigned',
    's2c-assigned-delivery'
  );

reset role;
set local role service_role;

create temporary table s2c_assigned_context as
select *
from public.get_notification_delivery_context_for_worker(
  (select id from s2c_ids where key = 'organisation'),
  (select id from s2c_ids where key = 'assigned_delivery'),
  (select id from s2c_ids where key = 'assigned_event')
);

select is(
  (select recipient_resolution_status from s2c_assigned_context),
  'deliverable',
  'active reviewer assignment resolves as deliverable'
);

select is(
  (select context_title from s2c_assigned_context),
  'Reduce changeover time',
  'reviewer assignment context uses suggestion title'
);

select ok(
  (select context_link_path from s2c_assigned_context)
    like '/platform/suggestions/review?queue=mine&suggestionId=%',
  'reviewer assignment context uses review queue deep link'
);

reset role;
set local role lean_hub_private_owner;

select lives_ok(
  $$select private.end_active_suggestion_review_assignment(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion')
  )$$,
  'active reviewer assignment ends'
);

reset role;
set local role service_role;

create temporary table s2c_stale_context as
select *
from public.get_notification_delivery_context_for_worker(
  (select id from s2c_ids where key = 'organisation'),
  (select id from s2c_ids where key = 'assigned_delivery'),
  (select id from s2c_ids where key = 'assigned_event')
);

select is(
  (select recipient_resolution_status from s2c_stale_context),
  'not_authorized',
  'stale reviewer assignment resolves as not_authorized'
);

reset role;
set local role lean_hub_private_owner;

insert into s2c_ids (key, id)
select
  'approved_event',
  private.enqueue_domain_event(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    'SuggestionAccepted',
    's2c-approved-event',
    jsonb_build_object('decision', 'accept')
  );

insert into s2c_ids (key, id)
select
  'approved_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'approved_event'),
    (select id from s2c_ids where key = 'owner_membership'),
    'suggestions.approved',
    's2c-approved-delivery'
  );

reset role;
set local role service_role;

create temporary table s2c_approved_context as
select *
from public.get_notification_delivery_context_for_worker(
  (select id from s2c_ids where key = 'organisation'),
  (select id from s2c_ids where key = 'approved_delivery'),
  (select id from s2c_ids where key = 'approved_event')
);

select is(
  (select context_detail from s2c_approved_context),
  'Your suggestion was approved',
  'approved notification context detail is author-facing'
);

select is(
  (select context_link_path from s2c_approved_context),
  '/platform/suggestions/' || (select id::text from s2c_ids where key = 'suggestion'),
  'approved notification context uses author detail deep link'
);

select * from finish();
rollback;
