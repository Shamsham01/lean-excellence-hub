begin;

select plan(36);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '96000000-0000-0000-0000-000000000001',
    'gemba-observation-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '96000000-0000-0000-0000-000000000003',
    'gemba-observation-walker@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '96000000-0000-0000-0000-000000000005',
    'gemba-observation-foreign@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table gemba_observation_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on gemba_observation_ids to authenticated;

insert into gemba_observation_ids (key, id)
values
  (
    'organisation',
    private.provision_organisation(
      '96000000-0000-0000-0000-000000000001',
      'gemba-observation-org',
      'Gemba Observation Organisation'
    )
  ),
  (
    'foreign_organisation',
    private.provision_organisation(
      '96000000-0000-0000-0000-000000000005',
      'gemba-observation-foreign-org',
      'Gemba Observation Foreign Organisation'
    )
  );

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values (
  (select id from gemba_observation_ids where key = 'organisation'),
  '96000000-0000-0000-0000-000000000003',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = '96000000-0000-0000-0000-000000000003';

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '96000000-0000-0000-0000-000000000002',
    '96000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '96000000-0000-0000-0000-000000000004',
    '96000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '96000000-0000-0000-0000-000000000006',
    '96000000-0000-0000-0000-000000000005',
    statement_timestamp(),
    statement_timestamp()
  );

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.gemba_walk_observations',
    'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.gemba_walk_observations',
    'DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.gemba_evidence_links',
    'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.gemba_evidence_links',
    'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.gemba_evidence_links',
    'DELETE'
  ),
  'authenticated has no direct mutation grants on gemba observations or evidence links'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'gemba_walk_observations'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ),
  0,
  'gemba observations have no insert/update/delete RLS policies'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_gemba_observation(uuid, text, text, uuid, uuid, text, text, uuid)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.update_gemba_observation(uuid, uuid, text, text)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.delete_gemba_observation(uuid, uuid)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.delete_gemba_observations(uuid, uuid[])',
    'execute'
  ),
  'authenticated can execute observation lifecycle RPCs'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.update_gemba_observation(uuid, uuid, text, text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.delete_gemba_observation(uuid, uuid)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.delete_gemba_observations(uuid, uuid[])',
    'execute'
  ),
  'anon cannot execute observation mutation RPCs'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000002","email":"gemba-observation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from gemba_observation_ids where key = 'organisation')
  ),
  'owner selects organisation'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''ops-site'', ''Operations Site'', ''site'')',
    (select id from gemba_observation_ids where key = 'organisation')
  ),
  'can create site'
);

insert into gemba_observation_ids (key, id)
select 'site', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (
  select id from gemba_observation_ids where key = 'organisation'
)
  and organisation_unit.code = 'ops-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''packing'', ''Packing'', ''area'')',
    (select id from gemba_observation_ids where key = 'organisation'),
    (select id from gemba_observation_ids where key = 'site')
  ),
  'can create packing unit'
);

insert into gemba_observation_ids (key, id)
select 'packing', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (
  select id from gemba_observation_ids where key = 'organisation'
)
  and organisation_unit.code = 'packing';

insert into gemba_observation_ids (key, id)
select 'definition', public.create_gemba_definition_draft(
  'Observation Lifecycle Walk',
  'Observation mutation coverage',
  null,
  array[(select id from gemba_observation_ids where key = 'packing')]
);

insert into gemba_observation_ids (key, id)
select 'version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (
  select id from gemba_observation_ids where key = 'definition'
)
  and version_row.version_number = 1;

insert into gemba_observation_ids (key, id)
select 'section', public.add_gemba_section(
  (select id from gemba_observation_ids where key = 'version'),
  'Floor',
  1
);

select lives_ok(
  format(
    'select public.add_gemba_question(%L::uuid, %L::uuid, ''short_text'', ''What is visible on the line?'', 1)',
    (select id from gemba_observation_ids where key = 'version'),
    (select id from gemba_observation_ids where key = 'section')
  ),
  'can add walk prompt'
);

select ok(
  public.publish_gemba_definition_version(
    (select id from gemba_observation_ids where key = 'version')
  ),
  'can publish gemba definition'
);

insert into gemba_observation_ids (key, id)
select 'walk', public.start_gemba_walk(
  (select id from gemba_observation_ids where key = 'definition'),
  (select id from gemba_observation_ids where key = 'packing')
);

insert into gemba_observation_ids (key, id)
select 'second_walk', public.start_gemba_walk(
  (select id from gemba_observation_ids where key = 'definition'),
  (select id from gemba_observation_ids where key = 'packing')
);

insert into gemba_observation_ids (key, id)
select 'observation', public.create_gemba_observation(
  (select id from gemba_observation_ids where key = 'walk'),
  'Floor labels are current and readable.',
  'positive_practice'
);

select is(
  (
    select observation_item.observation_text
    from public.gemba_walk_observations observation_item
    where observation_item.id = (
      select id from gemba_observation_ids where key = 'observation'
    )
  ),
  'Floor labels are current and readable.',
  'authorised performer can create a user-authored observation'
);

select throws_ok(
  format(
    'select public.create_gemba_observation(%L::uuid, %L, %L)',
    (select id from gemba_observation_ids where key = 'walk'),
    '   ',
    'issue'
  ),
  '22023',
  'gemba observation text is required',
  'empty observation text is rejected server-side'
);

insert into gemba_observation_ids (key, id)
select 'idempotent', public.create_gemba_observation(
  (select id from gemba_observation_ids where key = 'walk'),
  'Tape is peeling from the standard work sheet.',
  'improvement_opportunity',
  null,
  null,
  null,
  null,
  '96000000-0000-0000-0000-0000000000aa'
);

select is(
  public.create_gemba_observation(
    (select id from gemba_observation_ids where key = 'walk'),
    'Tape is peeling from the standard work sheet.',
    'improvement_opportunity',
    null,
    null,
    null,
    null,
    '96000000-0000-0000-0000-0000000000aa'
  ),
  (select id from gemba_observation_ids where key = 'idempotent'),
  'repeated create with the same client request id returns the original observation'
);

select is(
  (
    select count(*)::integer
    from public.gemba_walk_observations observation_item
    where observation_item.walk_id = (
      select id from gemba_observation_ids where key = 'walk'
    )
      and observation_item.client_request_id = '96000000-0000-0000-0000-0000000000aa'
  ),
  1,
  'idempotent create does not insert a duplicate observation'
);

select ok(
  public.update_gemba_observation(
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'observation'),
    'Updated: visual standard is current.',
    'positive_practice'
  ),
  'authorised performer can update an in-progress observation'
);

select is(
  (
    select observation_item.observation_text
    from public.gemba_walk_observations observation_item
    where observation_item.id = (
      select id from gemba_observation_ids where key = 'observation'
    )
  ),
  'Updated: visual standard is current.',
  'updated observation text is persisted'
);

insert into gemba_observation_ids (key, id)
select 'to_delete', public.create_gemba_observation(
  (select id from gemba_observation_ids where key = 'walk'),
  'Temporary placeholder observation.',
  'issue'
);

select ok(
  public.delete_gemba_observation(
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'to_delete')
  ),
  'authorised performer can delete an in-progress observation'
);

select is(
  (
    select count(*)::integer
    from public.gemba_walk_observations observation_item
    where observation_item.id = (
      select id from gemba_observation_ids where key = 'to_delete'
    )
  ),
  0,
  'deleted observation is removed'
);

insert into gemba_observation_ids (key, id)
select 'bulk_one', public.create_gemba_observation(
  (select id from gemba_observation_ids where key = 'walk'),
  'First bulk cleanup observation.',
  'issue'
);

insert into gemba_observation_ids (key, id)
select 'bulk_two', public.create_gemba_observation(
  (select id from gemba_observation_ids where key = 'walk'),
  'Second bulk cleanup observation.',
  'issue'
);

insert into gemba_observation_ids (key, id)
select 'foreign_walk_observation', public.create_gemba_observation(
  (select id from gemba_observation_ids where key = 'second_walk'),
  'Observation on a different walk.',
  'issue'
);

select throws_ok(
  format(
    'select public.delete_gemba_observations(%L::uuid, array[%L::uuid, %L::uuid])',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'bulk_one'),
    (select id from gemba_observation_ids where key = 'foreign_walk_observation')
  ),
  '42501',
  'gemba observation deletion is not authorised',
  'bulk delete cannot target observations from another walk'
);

select is(
  (
    select count(*)::integer
    from public.gemba_walk_observations observation_item
    where observation_item.id in (
      (select id from gemba_observation_ids where key = 'bulk_one'),
      (select id from gemba_observation_ids where key = 'bulk_two'),
      (select id from gemba_observation_ids where key = 'foreign_walk_observation')
    )
  ),
  3,
  'failed bulk delete does not remove any requested observations'
);

select is(
  public.delete_gemba_observations(
    (select id from gemba_observation_ids where key = 'walk'),
    array[
      (select id from gemba_observation_ids where key = 'bulk_one'),
      (select id from gemba_observation_ids where key = 'bulk_two')
    ]
  ),
  2,
  'authorised bulk delete removes selected in-progress observations'
);

insert into gemba_observation_ids (key, id)
select 'attachment', upload_row.attachment_id
from public.initiate_attachment_upload(
  (select id from gemba_observation_ids where key = 'walk'),
  'floor-photo.jpg',
  'image/jpeg',
  2048
) upload_row;

select ok(
  public.confirm_attachment_upload(
    (select id from gemba_observation_ids where key = 'attachment')
  ),
  'walk attachment can be confirmed'
);

select lives_ok(
  format(
    'select public.link_gemba_evidence(%L::uuid, %L::uuid, null, null, %L::uuid)',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'attachment'),
    (select id from gemba_observation_ids where key = 'observation')
  ),
  'observation evidence can link on the same walk'
);

select throws_ok(
  format(
    'select public.link_gemba_evidence(%L::uuid, %L::uuid, null, null, %L::uuid)',
    (select id from gemba_observation_ids where key = 'second_walk'),
    (select id from gemba_observation_ids where key = 'attachment'),
    (select id from gemba_observation_ids where key = 'foreign_walk_observation')
  ),
  '22023',
  'gemba evidence attachment is not valid for this walk',
  'observation evidence cannot cross-link a walk-owned attachment'
);

select throws_ok(
  format(
    'select public.link_gemba_evidence(%L::uuid, %L::uuid, null, null, %L::uuid)',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'attachment'),
    (select id from gemba_observation_ids where key = 'foreign_walk_observation')
  ),
  '22023',
  'gemba observation does not belong to this walk',
  'observation evidence cannot attach to another walk observation'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000004","email":"gemba-observation-walker@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from gemba_observation_ids where key = 'organisation')
  ),
  'unprivileged walker selects organisation'
);

select ok(
  not public.member_has_permission('gemba.walk.perform'),
  'applicability does not grant walk-perform authority'
);

select throws_ok(
  format(
    'select public.create_gemba_observation(%L::uuid, %L, %L)',
    (select id from gemba_observation_ids where key = 'walk'),
    'Unauthorised observation',
    'issue'
  ),
  '42501',
  'gemba observation creation is not authorised',
  'inaccessible walk observation create is rejected'
);

select throws_ok(
  format(
    'select public.update_gemba_observation(%L::uuid, %L::uuid, %L, %L)',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'observation'),
    'Unauthorised edit',
    'issue'
  ),
  '42501',
  'gemba observation change is not authorised',
  'inaccessible walk observation update is rejected'
);

select throws_ok(
  format(
    'select public.delete_gemba_observation(%L::uuid, %L::uuid)',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'observation')
  ),
  '42501',
  'gemba observation change is not authorised',
  'inaccessible walk observation delete is rejected'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000006","email":"gemba-observation-foreign@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from gemba_observation_ids where key = 'foreign_organisation')
  ),
  'foreign owner selects organisation'
);

select throws_ok(
  format(
    'select public.create_gemba_observation(%L::uuid, %L, %L)',
    (select id from gemba_observation_ids where key = 'walk'),
    'Foreign observation',
    'issue'
  ),
  '42501',
  'gemba observation creation is not authorised',
  'wrong organisation observation create is rejected'
);

select throws_ok(
  format(
    'select public.update_gemba_observation(%L::uuid, %L::uuid, %L, %L)',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'observation'),
    'Foreign edit',
    'issue'
  ),
  '42501',
  'gemba observation change is not authorised',
  'wrong organisation observation update is rejected'
);

select throws_ok(
  format(
    'select public.delete_gemba_observations(%L::uuid, array[%L::uuid])',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'observation')
  ),
  '42501',
  'gemba observation deletion is not authorised',
  'wrong organisation bulk delete is rejected'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000002","email":"gemba-observation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from gemba_observation_ids where key = 'organisation')
  ),
  'owner resumes organisation context'
);

select ok(
  public.complete_gemba_walk(
    (select id from gemba_observation_ids where key = 'walk'),
    'Completed with intentional observations.'
  ),
  'walk can complete after observation lifecycle'
);

select throws_ok(
  format(
    'select public.update_gemba_observation(%L::uuid, %L::uuid, %L, %L)',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'observation'),
    'Completed edit',
    'issue'
  ),
  '42501',
  'gemba observation change is not authorised',
  'completed-walk observation update is rejected'
);

select throws_ok(
  format(
    'select public.delete_gemba_observation(%L::uuid, %L::uuid)',
    (select id from gemba_observation_ids where key = 'walk'),
    (select id from gemba_observation_ids where key = 'observation')
  ),
  '42501',
  'gemba observation change is not authorised',
  'completed-walk observation delete is rejected'
);

select is(
  (
    select observation_item.observation_text
    from public.gemba_walk_observations observation_item
    where observation_item.id = (
      select id from gemba_observation_ids where key = 'observation'
    )
  ),
  'Updated: visual standard is current.',
  'completed observation text remains immutable'
);

select * from finish();
rollback;
