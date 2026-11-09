begin;

select plan(27);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'c3413000-0000-4000-8000-000000000001',
  'chase-remediation@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table chase_rem_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on chase_rem_ids to authenticated, lean_hub_private_owner, postgres;

insert into chase_rem_ids (key, id)
values (
  'org',
  private.provision_organisation(
    'c3413000-0000-4000-8000-000000000001',
    'chase-remediation-org',
    'Chase remediation org'
  )
);

insert into chase_rem_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from chase_rem_ids where key = 'org')
  and membership_row.user_id = 'c3413000-0000-4000-8000-000000000001';

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'c3413100-0000-4000-8000-000000000001',
  'c3413000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
);

set local role postgres;

select is(
  (
    select scheduler_enabled
    from private.in_app_operational_chase_scheduler_settings
    where singleton_id = true
  ),
  false,
  'scheduler_enabled defaults to false'
);

select is(
  private.invoke_in_app_operational_chase_worker(),
  0,
  'disabled scheduler worker inserts nothing'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c3413000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3413100-0000-4000-8000-000000000001","email":"chase-remediation@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from chase_rem_ids where key = 'org')),
  'org selected for remediation fixtures'
);

insert into chase_rem_ids (key, id)
select 'unit', public.create_organisation_unit(
  (select id from chase_rem_ids where key = 'org'),
  null,
  'chase-rem-site',
  'Chase Rem Site',
  'site'
);

-- Historical overdue (predates scheduler enable)
insert into chase_rem_ids (key, id)
select 'historical_action', public.create_action(
  'Historical overdue',
  'Before scheduler watermark',
  'normal',
  (select id from chase_rem_ids where key = 'unit'),
  null,
  null,
  'chase-rem-historical'
);

select ok(
  public.update_action(
    (select id from chase_rem_ids where key = 'historical_action'),
    'Historical overdue',
    'Before scheduler watermark',
    'normal',
    statement_timestamp() - interval '10 days',
    false,
    1
  ),
  'historical action backdated'
);

select ok(
  public.set_action_assignee(
    (select id from chase_rem_ids where key = 'historical_action'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  'historical assignee set'
);

reset role;
set local role postgres;

update private.in_app_operational_chase_scheduler_settings
set scheduler_enabled = true
where singleton_id = true;

select ok(
  (
    select chase_eligibility_watermark is not null
    from private.in_app_chase_worker_cursor
    where singleton_id = true
  ),
  'enabling scheduler seeds chase eligibility watermark'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications
    where organisation_id = (select id from chase_rem_ids where key = 'org')
      and notification_type = 'leanai.chase_overdue_action'
  ),
  0::bigint,
  'worker enabled does not backfill historical overdue actions'
);

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_rem_ids where key = 'org'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  '>=',
  0,
  'sync after watermark still runs safely for historical items'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications
    where organisation_id = (select id from chase_rem_ids where key = 'org')
      and notification_type = 'leanai.chase_overdue_action'
  ),
  0::bigint,
  'historical overdue remains unchased after watermarked sync'
);

-- Item that becomes due after watermark (watermark backdated for deterministic eligibility)
update private.in_app_chase_worker_cursor
set chase_eligibility_watermark = statement_timestamp() - interval '2 days'
where singleton_id = true;

reset role;
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3413000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3413100-0000-4000-8000-000000000001","email":"chase-remediation@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from chase_rem_ids where key = 'org')),
  'org re-selected'
);

insert into chase_rem_ids (key, id)
select 'fresh_action', public.create_action(
  'Fresh overdue',
  'After scheduler watermark',
  'normal',
  (select id from chase_rem_ids where key = 'unit'),
  null,
  null,
  'chase-rem-fresh'
);

select ok(
  public.update_action(
    (select id from chase_rem_ids where key = 'fresh_action'),
    'Fresh overdue',
    'After scheduler watermark',
    'normal',
    clock_timestamp() - interval '2 hours',
    false,
    1
  ),
  'fresh action due after watermark'
);

select ok(
  public.set_action_assignee(
    (select id from chase_rem_ids where key = 'fresh_action'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  'fresh action assignee'
);

reset role;
set local role postgres;

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_rem_ids where key = 'org'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  '>=',
  1,
  'post-watermark due work creates chase rows'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications
    where dedupe_key like 'overdue_action:' || (select id::text from chase_rem_ids where key = 'fresh_action') || ':%'
  ),
  1::bigint,
  'fresh overdue action chase type emitted'
);

-- Daily cap across runs (reset quota + chase rows for a clean cap window)
delete from private.in_app_chase_recipient_daily_quota
where organisation_id = (select id from chase_rem_ids where key = 'org');

delete from public.in_app_notifications
where organisation_id = (select id from chase_rem_ids where key = 'org')
  and notification_type like 'leanai.chase_%';

update private.in_app_operational_chase_scheduler_settings
set daily_new_chase_cap = 2,
    per_member_chase_limit = 2
where singleton_id = true;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c3413000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3413100-0000-4000-8000-000000000001","email":"chase-remediation@example.test"}',
  true
);
select ok(public.switch_organisation((select id from chase_rem_ids where key = 'org')), 'org for cap test');

insert into chase_rem_ids (key, id)
select
  'cap_action_' || series_value::text,
  public.create_action(
    'Cap action ' || series_value::text,
    'daily quota',
    'normal',
    (select id from chase_rem_ids where key = 'unit'),
    null,
    null,
    'chase-rem-cap-' || series_value::text
  )
from generate_series(1, 3) as series_value;

reset role;
set local role postgres;

update public.actions action_row
set due_at = clock_timestamp() - interval '1 hour'
where action_row.id in (
  select id from chase_rem_ids where key like 'cap_action_%'
);

reset role;
set local role authenticated;

select ok(
  public.set_action_assignee(
    (select id from chase_rem_ids where key = 'cap_action_1'),
    (select id from chase_rem_ids where key = 'membership')
  )
  and public.set_action_assignee(
    (select id from chase_rem_ids where key = 'cap_action_2'),
    (select id from chase_rem_ids where key = 'membership')
  )
  and public.set_action_assignee(
    (select id from chase_rem_ids where key = 'cap_action_3'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  'cap actions assigned'
);

reset role;
set local role postgres;

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_rem_ids where key = 'org'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  '>=',
  1,
  'first cap-limited sync runs'
);

select cmp_ok(
  (
    select private.in_app_chase_new_rows_created_today(
      (select id from chase_rem_ids where key = 'org'),
      (select id from chase_rem_ids where key = 'membership')
    )
  ),
  '<=',
  2,
  'daily quota consumption is bounded after first sync'
);

create temporary table chase_cap_quota_snapshot (
  consumed integer not null
) on commit drop;

insert into chase_cap_quota_snapshot (consumed)
select private.in_app_chase_new_rows_created_today(
  (select id from chase_rem_ids where key = 'org'),
  (select id from chase_rem_ids where key = 'membership')
);

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_rem_ids where key = 'org'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  '>=',
  0,
  'second sync same day is safe under cap'
);

select is(
  (select consumed from chase_cap_quota_snapshot),
  private.in_app_chase_new_rows_created_today(
    (select id from chase_rem_ids where key = 'org'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  'quota is unchanged across cap-exhausted runs (no double spend)'
);

select ok(
  exists (
    select 1
    from public.in_app_notifications
    where organisation_id = (select id from chase_rem_ids where key = 'org')
      and membership_id = (select id from chase_rem_ids where key = 'membership')
      and notification_type = 'leanai.chase_digest'
  ),
  'digest summary appears when backlog exceeds daily cap'
);

-- Org preference disabled
insert into private.organisation_in_app_notification_prefs (
  organisation_id,
  operational_chases_enabled
) values (
  (select id from chase_rem_ids where key = 'org'),
  false
)
on conflict (organisation_id) do update
set operational_chases_enabled = excluded.operational_chases_enabled;

select is(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_rem_ids where key = 'org'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  0,
  'org preference disables new chase sync'
);

delete from private.organisation_in_app_notification_prefs
where organisation_id = (select id from chase_rem_ids where key = 'org');

-- Stale walk chase type (minimal gemba walk left in progress)
update private.in_app_chase_worker_cursor
set chase_eligibility_watermark = null
where singleton_id = true;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c3413000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3413100-0000-4000-8000-000000000001","email":"chase-remediation@example.test"}',
  true
);
select ok(public.switch_organisation((select id from chase_rem_ids where key = 'org')), 'org for stale walk');

insert into chase_rem_ids (key, id)
select 'gemba_def', public.create_gemba_definition_draft(
  'Chase stale walk',
  'Remediation stale walk chase',
  null,
  array[(select id from chase_rem_ids where key = 'unit')]
);

insert into chase_rem_ids (key, id)
select 'gemba_version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from chase_rem_ids where key = 'gemba_def')
  and version_row.version_number = 1;

insert into chase_rem_ids (key, id)
select 'gemba_section', public.add_gemba_section(
  (select id from chase_rem_ids where key = 'gemba_version'),
  'Floor',
  1
);

insert into chase_rem_ids (key, id)
select 'gemba_question', public.add_gemba_question(
  target_definition_version_id := (select id from chase_rem_ids where key = 'gemba_version'),
  target_section_id := (select id from chase_rem_ids where key = 'gemba_section'),
  target_question_type := 'short_text',
  target_prompt := 'Note',
  target_position := 1,
  target_is_required := false,
  target_allows_not_applicable := false
);

select ok(
  public.publish_gemba_definition_version((select id from chase_rem_ids where key = 'gemba_version')),
  'publish gemba definition for stale walk'
);

insert into chase_rem_ids (key, id)
select 'stale_walk', public.start_gemba_walk(
  (select id from chase_rem_ids where key = 'gemba_def'),
  (select id from chase_rem_ids where key = 'unit')
);

reset role;
set local role postgres;

update public.gemba_walks walk_row
set status = 'in_progress',
    started_at = statement_timestamp() - interval '5 days'
where walk_row.id = (select id from chase_rem_ids where key = 'stale_walk');

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase_rem_ids where key = 'org'),
    (select id from chase_rem_ids where key = 'membership')
  ),
  '>=',
  1,
  'stale gemba walk chase type can emit'
);

select ok(
  exists (
    select 1 from public.in_app_notifications
    where notification_type = 'leanai.chase_stale_walk'
      and organisation_id = (select id from chase_rem_ids where key = 'org')
  ),
  'stale walk notification row exists'
);

-- Disabled worker after enabling settings again
update private.in_app_operational_chase_scheduler_settings
set scheduler_enabled = false
where singleton_id = true;

select is(
  private.invoke_in_app_operational_chase_worker(),
  0,
  'scheduler re-disabled yields zero worker inserts'
);

select * from finish();

rollback;
