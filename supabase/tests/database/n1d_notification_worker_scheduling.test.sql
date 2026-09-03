begin;

select plan(12);

create temporary table n1d_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on n1d_ids to authenticated, lean_hub_private_owner, service_role;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'f1100000-0000-0000-0000-000000000001',
  'n1d-cutover-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

select ok(
  (select cutover_at from private.notification_projector_consumer_state where singleton_id = true) is not null,
  'notification projector cutover timestamp is configured'
);

select ok(
  to_regclass('private.notification_projector_pre_cutover_skips') is not null,
  'pre-cutover skip audit table exists'
);

set local role lean_hub_private_owner;

insert into n1d_ids (key, id)
select
  'organisation',
  private.provision_organisation(
    'f1100000-0000-0000-0000-000000000001',
    'n1d-cutover-org',
    'N1d Cutover Organisation'
  );

with inserted_pre_cutover as (
  insert into private.domain_event_outbox (
    organisation_id,
    event_type,
    payload,
    idempotency_key,
    processing_state,
    created_at,
    available_at
  )
  values (
    (select id from n1d_ids where key = 'organisation'),
    'TemplatePublished',
    '{}'::jsonb,
    'n1d-pre-cutover-historical-event',
    'pending',
    private.notification_projector_cutover_at() - interval '1 day',
    statement_timestamp()
  )
  returning id
)
insert into n1d_ids (key, id)
select 'pre_cutover_event', inserted_pre_cutover.id
from inserted_pre_cutover;

select is(
  (select count(*)::integer
   from private.claim_domain_events_for_notification_projector(10)),
  0,
  'notification projector does not claim pre-cutover pending events'
);

select is(
  (select processing_state
   from private.domain_event_outbox outbox_row
   where outbox_row.id = (select id from n1d_ids where key = 'pre_cutover_event')),
  'pending',
  'pre-cutover outbox row remains pending for other consumers'
);

insert into private.domain_event_outbox (
  organisation_id,
  event_type,
  payload,
  idempotency_key,
  processing_state,
  created_at,
  available_at
)
values (
  (select id from n1d_ids where key = 'organisation'),
  'TemplatePublished',
  '{}'::jsonb,
  'n1d-post-cutover-event',
  'pending',
  statement_timestamp(),
  statement_timestamp()
);

select ok(
  (select count(*) = 1 from private.claim_domain_events_for_notification_projector(10)),
  'post-cutover pending event is claimable by notification projector'
);

select ok(
  to_regprocedure('private.invoke_notification_projector_worker()') is not null,
  'projector invoke function exists'
);

select ok(
  to_regprocedure('private.invoke_notification_delivery_worker()') is not null,
  'delivery invoke function exists'
);

select ok(
  to_regprocedure('private.notification_operational_health()') is not null,
  'operational health function exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"f1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select private.invoke_notification_projector_worker()',
  '42501',
  null,
  'authenticated cannot invoke projector scheduler function'
);

select throws_ok(
  'select private.notification_operational_health()',
  '42501',
  null,
  'authenticated cannot read operational health diagnostics'
);

reset role;
set local role postgres;

select ok(
  (
    select count(*) >= 1
    from cron.job cron_job
    where cron_job.jobname = 'leh_notification_projector_every_minute'
  ),
  'projector cron job is registered'
);

select ok(
  (
    select count(*) >= 1
    from cron.job cron_job
    where cron_job.jobname = 'leh_notification_delivery_every_minute'
  ),
  'delivery cron job is registered'
);

select * from finish();
rollback;
