begin;

select plan(15);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'c3415000-0000-4000-8000-000000000001',
  'chase-prod@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table chase_prod_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on chase_prod_ids to authenticated, lean_hub_private_owner, postgres;

insert into chase_prod_ids (key, id)
values (
  'org',
  private.provision_organisation(
    'c3415000-0000-4000-8000-000000000001',
    'chase-prod-org',
    'Chase production org'
  )
);

insert into chase_prod_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from chase_prod_ids where key = 'org')
  and membership_row.user_id = 'c3415000-0000-4000-8000-000000000001';

select public.apply_organisation_subscription_snapshot(
  (select id from chase_prod_ids where key = 'org'),
  'fake',
  'cus_chase_prod',
  'sub_chase_prod',
  'essentials',
  'monthly',
  1,
  'price_fake',
  'active',
  'active',
  statement_timestamp(),
  statement_timestamp() + interval '30 days',
  false,
  timestamptz '2026-11-09 12:00:00+00'
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'c3415100-0000-4000-8000-000000000001',
  'c3415000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

set local role postgres;

update private.in_app_operational_chase_scheduler_settings
set scheduler_enabled = true,
    scheduler_enabled_at = coalesce(scheduler_enabled_at, statement_timestamp())
where singleton_id = true;

set local role lean_hub_private_owner;

select is(
  private.sweep_in_app_chase_recipient_daily_quota(45),
  0,
  'quota sweep runs on empty ledger'
);

insert into private.in_app_chase_recipient_daily_quota (
  organisation_id,
  membership_id,
  quota_utc_day,
  consumed_new_chase_count
) values (
  (select id from chase_prod_ids where key = 'org'),
  (select id from chase_prod_ids where key = 'membership'),
  (statement_timestamp() at time zone 'UTC')::date - 120,
  3
);

select is(
  private.sweep_in_app_chase_recipient_daily_quota(45),
  1,
  'quota sweep removes rows older than retention window'
);

-- Digest staleness guard
insert into public.in_app_notifications (
  organisation_id,
  membership_id,
  notification_type,
  title,
  body,
  href,
  dedupe_key
) values (
  (select id from chase_prod_ids where key = 'org'),
  (select id from chase_prod_ids where key = 'membership'),
  'leanai.chase_digest',
  'Several items need attention',
  'Stale digest body',
  '/platform/actions',
  'chase_digest:' || to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD')
);

select lives_ok(
  $$
    select private.upsert_in_app_chase_digest(
      (select id from chase_prod_ids where key = 'org'),
      (select id from chase_prod_ids where key = 'membership')
    );
  $$,
  'digest staleness guard callable'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications
    where organisation_id = (select id from chase_prod_ids where key = 'org')
      and notification_type = 'leanai.chase_digest'
  ),
  0::bigint,
  'digest staleness guard removes summary when unread backlog is below threshold'
);

-- Pre-watermark expiry (TTL only; recent pre-watermark rows are kept)
update private.in_app_chase_worker_cursor
set chase_eligibility_watermark = statement_timestamp()
where singleton_id = true;

insert into public.in_app_notifications (
  organisation_id,
  membership_id,
  notification_type,
  title,
  body,
  href,
  dedupe_key,
  created_at
) values (
  (select id from chase_prod_ids where key = 'org'),
  (select id from chase_prod_ids where key = 'membership'),
  'leanai.chase_overdue_action',
  'Ancient pre-watermark',
  'Should expire',
  '/platform/actions',
  'overdue_action:expired-pre-watermark-test:' || (select id::text from chase_prod_ids where key = 'membership'),
  statement_timestamp() - interval '200 days'
);

select is(
  private.sweep_expired_pre_watermark_chase_notifications(interval '180 days'),
  1,
  'pre-watermark chase rows older than max_age are expired'
);

insert into public.in_app_notifications (
  organisation_id,
  membership_id,
  notification_type,
  title,
  body,
  href,
  dedupe_key,
  created_at
) values (
  (select id from chase_prod_ids where key = 'org'),
  (select id from chase_prod_ids where key = 'membership'),
  'leanai.chase_overdue_action',
  'Recent pre-watermark',
  'Should remain',
  '/platform/actions',
  'overdue_action:kept-pre-watermark-test:' || (select id::text from chase_prod_ids where key = 'membership'),
  statement_timestamp() - interval '10 days'
);

select is(
  private.sweep_expired_pre_watermark_chase_notifications(interval '180 days'),
  0,
  'recent pre-watermark chase rows are not expired by TTL sweep'
);

update private.in_app_chase_worker_cursor
set chase_eligibility_watermark = null
where singleton_id = true;

select is(
  private.sweep_expired_pre_watermark_chase_notifications(interval '180 days'),
  0,
  'pre-watermark chase TTL sweep is a no-op when eligibility watermark is null'
);

-- Module plan gate: gemba stale chases suppressed when billing is non-operational
reset role;
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3415000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3415100-0000-4000-8000-000000000001","email":"chase-prod@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from chase_prod_ids where key = 'org')),
  'org selected for module chase gate'
);

insert into chase_prod_ids (key, id)
select 'unit', public.create_organisation_unit(
  (select id from chase_prod_ids where key = 'org'),
  null,
  'chase-prod-site',
  'Chase Prod Site',
  'site'
);

insert into chase_prod_ids (key, id)
select 'gemba_def', public.create_gemba_definition_draft(
  'Plan gate walk',
  'Module chase gate',
  null,
  array[(select id from chase_prod_ids where key = 'unit')]
);

insert into chase_prod_ids (key, id)
select 'gemba_version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from chase_prod_ids where key = 'gemba_def')
  and version_row.version_number = 1;

insert into chase_prod_ids (key, id)
select 'gemba_section', public.add_gemba_section(
  (select id from chase_prod_ids where key = 'gemba_version'),
  'Floor',
  1
);

insert into chase_prod_ids (key, id)
select 'gemba_question', public.add_gemba_question(
  target_definition_version_id := (select id from chase_prod_ids where key = 'gemba_version'),
  target_section_id := (select id from chase_prod_ids where key = 'gemba_section'),
  target_question_type := 'short_text',
  target_prompt := 'Note',
  target_position := 1,
  target_is_required := false,
  target_allows_not_applicable := false
);

select ok(
  public.publish_gemba_definition_version((select id from chase_prod_ids where key = 'gemba_version')),
  'publish gemba definition for module gate'
);

insert into chase_prod_ids (key, id)
select 'stale_walk', public.start_gemba_walk(
  (select id from chase_prod_ids where key = 'gemba_def'),
  (select id from chase_prod_ids where key = 'unit')
);

reset role;
set local role postgres;

update public.gemba_walks walk_row
set status = 'in_progress',
    started_at = statement_timestamp() - interval '5 days',
    leader_membership_id = (select id from chase_prod_ids where key = 'membership')
where walk_row.id = (select id from chase_prod_ids where key = 'stale_walk');

update private.in_app_chase_worker_cursor
set chase_eligibility_watermark = null
where singleton_id = true;

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_prod_ids where key = 'org'),
    (select id from chase_prod_ids where key = 'membership')
  ),
  '>=',
  1,
  'operational billing emits gemba stale chase'
);

delete from public.in_app_notifications
where organisation_id = (select id from chase_prod_ids where key = 'org')
  and notification_type like 'leanai.chase_%';

select public.apply_organisation_subscription_snapshot(
  (select id from chase_prod_ids where key = 'org'),
  'fake',
  'cus_chase_prod',
  'sub_chase_prod',
  'essentials',
  'monthly',
  1,
  'price_fake',
  'past_due',
  'past_due',
  statement_timestamp(),
  statement_timestamp() + interval '30 days',
  false,
  timestamptz '2026-11-09 12:00:00+00',
  statement_timestamp() - interval '1 hour'
);

select ok(
  not private.organisation_plan_capability(
    (select id from chase_prod_ids where key = 'org'),
    'module_gemba'
  ),
  'non-operational billing denies module_gemba capability for chase gating'
);

select is(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_prod_ids where key = 'org'),
    (select id from chase_prod_ids where key = 'membership')
  ),
  0,
  'module-gated stale gemba chase suppressed when plan modules are unavailable'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications
    where organisation_id = (select id from chase_prod_ids where key = 'org')
      and notification_type = 'leanai.chase_stale_walk'
  ),
  0::bigint,
  'no stale walk chase rows when module entitlement is denied'
);

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'leh_in_app_chase_quota_retention_daily'
  ),
  'quota retention sweep cron is registered'
);

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'leh_in_app_chase_prewatermark_expiry_weekly'
  ),
  'pre-watermark chase expiry sweep cron is registered'
);

select * from finish();
rollback;
