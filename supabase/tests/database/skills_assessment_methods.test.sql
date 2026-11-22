begin;

select plan(15);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '93500000-0000-0000-0000-000000000001',
  'skills-methods@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table skills_methods_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on skills_methods_ids to authenticated;

insert into skills_methods_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '93500000-0000-0000-0000-000000000001',
    'skills-methods-org',
    'Skills Methods Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '94500000-0000-0000-0000-000000000001',
  '93500000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94500000-0000-0000-0000-000000000001","email":"skills-methods@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from skills_methods_ids where key = 'organisation')),
  'methods owner selects organisation'
);

insert into skills_methods_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Methods Scale');

insert into skills_methods_ids (key, id)
select 'scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_methods_ids where key = 'scale')
  and version_row.version_number = 1;

select ok(
  public.add_skill_proficiency_level(
    (select id from skills_methods_ids where key = 'scale_version'),
    1,
    'Level 1'
  ) is not null,
  'add proficiency level'
);

select public.add_skill_proficiency_level(
  (select id from skills_methods_ids where key = 'scale_version'),
  2,
  'Level 2'
);

select ok(
  public.publish_skill_proficiency_scale_version(
    (select id from skills_methods_ids where key = 'scale_version')
  ),
  'publish proficiency scale'
);

insert into skills_methods_ids (key, id)
select 'skill', public.create_skill('Welding', 'welding');

insert into skills_methods_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from skills_methods_ids where key = 'organisation')
  and membership_row.user_id = '93500000-0000-0000-0000-000000000001';

select ok(
  public.record_skill_validation(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    ),
    statement_timestamp(),
    null,
    'manager_assessment'
  ) is not null,
  'manager_assessment succeeds'
);

select is(
  (
    select assessment_method
    from public.membership_skill_assessments
    order by assessed_at desc
    limit 1
  ),
  'manager_assessment',
  'manager_assessment stored'
);

select ok(
  public.record_skill_validation(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    ),
    statement_timestamp(),
    null,
    'practical_observation'
  ) is not null,
  'practical_observation succeeds'
);

select is(
  (
    select assessment_method
    from public.membership_skill_assessments
    order by assessed_at desc
    limit 1
  ),
  'practical_observation',
  'practical_observation stored'
);

select ok(
  public.record_skill_validation(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    ),
    statement_timestamp(),
    null,
    'qualification'
  ) is not null,
  'qualification succeeds'
);

select ok(
  public.record_skill_validation(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    ),
    statement_timestamp(),
    null,
    'trainer_sign_off'
  ) is not null,
  'trainer_sign_off succeeds'
);

select ok(
  public.record_skill_validation(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    ),
    statement_timestamp(),
    null,
    'external_certification'
  ) is not null,
  'external_certification succeeds'
);

select throws_ok(
  $$select public.record_skill_validation(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    ),
    statement_timestamp(),
    null,
  'observation'
  )$$,
  '22023',
  'skill validation requires a recognised assessment method',
  'invalid observation token rejected'
);

select throws_ok(
  $$select public.record_skill_validation(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    )
  )$$,
  '22023',
  'skill validation requires a recognised assessment method',
  'omitted assessment method rejected'
);

select throws_ok(
  $$select public.record_skill_self_assessment(
    (select id from skills_methods_ids where key = 'membership'),
    (select id from skills_methods_ids where key = 'skill'),
    (select id from skills_methods_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
        and level_row.order_value = 1
    ),
  null::timestamptz,
    'manager_assessment'
  )$$,
  '22023',
  'skill self assessment requires the self_assessment method',
  'self assessment rejects validation methods'
);

insert into skills_methods_ids (key, id)
select 'self_assessment', public.record_skill_self_assessment(
  (select id from skills_methods_ids where key = 'membership'),
  (select id from skills_methods_ids where key = 'skill'),
  (select id from skills_methods_ids where key = 'scale_version'),
  (
    select level_row.id
    from public.skill_proficiency_levels level_row
    where level_row.scale_version_id = (select id from skills_methods_ids where key = 'scale_version')
      and level_row.order_value = 1
  )
);

select is(
  (
    select assessment_method
    from public.membership_skill_assessments
    where id = (select id from skills_methods_ids where key = 'self_assessment')
  ),
  'self_assessment',
  'self assessment path still stores self_assessment'
);

select is(
  (
    select assertion_type
    from public.membership_skill_assessments
    where id = (select id from skills_methods_ids where key = 'self_assessment')
  ),
  'self_assessed',
  'self assessment assertion_type unchanged'
);

reset role;

select * from finish();
rollback;
