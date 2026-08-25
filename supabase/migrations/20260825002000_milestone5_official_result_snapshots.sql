-- Immutable presentation snapshots for official maturity results.

alter table public.maturity_official_results
  add column if not exists model_name_snapshot text,
  add column if not exists model_version_number_snapshot integer,
  add column if not exists unit_id_snapshot uuid,
  add column if not exists unit_name_snapshot text,
  add column if not exists unit_code_snapshot text,
  add column if not exists assessment_type_snapshot text;

create table if not exists public.maturity_official_result_levels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  official_result_id uuid not null,
  level_number integer not null,
  name text not null,
  description text,
  color_token text,
  guidance text,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_official_result_levels_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_official_result_levels_result_level_key
    unique (organisation_id, official_result_id, level_number),
  constraint maturity_official_result_levels_result_fkey
    foreign key (organisation_id, official_result_id)
    references public.maturity_official_results(organisation_id, id)
    on delete restrict,
  constraint maturity_official_result_levels_level_number_check
    check (level_number > 0)
);

alter table public.maturity_official_result_levels enable row level security;
alter table public.maturity_official_result_levels force row level security;

revoke all on public.maturity_official_result_levels
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.maturity_official_result_levels
  to lean_hub_private_owner;

create policy private_owner_all_maturity_official_result_levels
on public.maturity_official_result_levels
for all to lean_hub_private_owner
using (true) with check (true);

create policy maturity_official_result_levels_select
on public.maturity_official_result_levels for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.maturity_official_results official_result
    where official_result.organisation_id = maturity_official_result_levels.organisation_id
      and official_result.id = maturity_official_result_levels.official_result_id
      and private.can_read_maturity_assessment(
        official_result.organisation_id,
        official_result.assessment_id
      )
  )
);

grant select on public.maturity_official_result_levels to authenticated;

create trigger maturity_official_result_levels_prevent_update
before update on public.maturity_official_result_levels
for each row execute function private.prevent_update_or_delete();

create trigger maturity_official_result_levels_prevent_delete
before delete on public.maturity_official_result_levels
for each row execute function private.prevent_update_or_delete();

create or replace function private.publish_official_maturity_result(
  target_assessment_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  current_status text;
  target_model_version_id uuid;
  target_submission_id uuid;
  target_unit_id uuid;
  overall_score numeric;
  official_result_id uuid;
  pillar_row record;
  level_row record;
  model_name text;
  model_version_number integer;
  unit_name text;
  unit_code text;
  assessment_type text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.results.publish', null, null) then
    raise exception 'official maturity result publication is not authorised'
      using errcode = '42501';
  end if;

  select
    assessment_row.status,
    assessment_row.model_version_id,
    assessment_row.submission_id,
    assessment_row.unit_id,
    assessment_row.assessment_type
  into current_status, target_model_version_id, target_submission_id, target_unit_id, assessment_type
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id
    and assessment_row.assessment_type = 'formal'
    and assessment_row.status = 'approved'
  for update;

  if not found then
    raise exception 'maturity assessment is not publishable'
      using errcode = '55000';
  end if;

  select score_row.score
  into overall_score
  from public.maturity_assessment_scores score_row
  where score_row.organisation_id = org_id
    and score_row.assessment_id = target_assessment_id
    and score_row.score_level = 'overall';

  if overall_score is null then
    raise exception 'maturity assessment has no overall score'
      using errcode = '55000';
  end if;

  select maturity_model.display_name, model_version.version_number
  into model_name, model_version_number
  from public.maturity_model_versions model_version
  join public.maturity_models maturity_model
    on maturity_model.organisation_id = model_version.organisation_id
   and maturity_model.id = model_version.model_id
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id;

  select organisation_unit.name, organisation_unit.code
  into unit_name, unit_code
  from public.organisation_units organisation_unit
  where organisation_unit.organisation_id = org_id
    and organisation_unit.id = target_unit_id;

  insert into public.maturity_official_results (
    organisation_id,
    assessment_id,
    model_version_id,
    overall_score,
    published_by_membership_id,
    published_at,
    model_name_snapshot,
    model_version_number_snapshot,
    unit_id_snapshot,
    unit_name_snapshot,
    unit_code_snapshot,
    assessment_type_snapshot
  )
  values (
    org_id,
    target_assessment_id,
    target_model_version_id,
    overall_score,
    actor_membership_id,
    statement_timestamp(),
    model_name,
    model_version_number,
    target_unit_id,
    unit_name,
    unit_code,
    assessment_type
  )
  returning id into official_result_id;

  for level_row in
    select
      level_item.level_number,
      level_item.name,
      level_item.description,
      level_item.color_token,
      level_item.guidance
    from public.maturity_levels level_item
    where level_item.organisation_id = org_id
      and level_item.model_version_id = target_model_version_id
    order by level_item.level_number
  loop
    insert into public.maturity_official_result_levels (
      organisation_id,
      official_result_id,
      level_number,
      name,
      description,
      color_token,
      guidance
    )
    values (
      org_id,
      official_result_id,
      level_row.level_number,
      level_row.name,
      level_row.description,
      level_row.color_token,
      level_row.guidance
    );
  end loop;

  for pillar_row in
    select
      pillar_item.id as pillar_id,
      pillar_item.name as pillar_name,
      pillar_item.position as pillar_position,
      score_item.score
    from public.maturity_pillars pillar_item
    join public.maturity_assessment_scores score_item
      on score_item.organisation_id = pillar_item.organisation_id
     and score_item.assessment_id = target_assessment_id
     and score_item.score_level = 'pillar'
     and score_item.entity_id = pillar_item.id
    where pillar_item.organisation_id = org_id
      and pillar_item.model_version_id = target_model_version_id
    order by pillar_item.position
  loop
    insert into public.maturity_official_result_pillars (
      organisation_id,
      official_result_id,
      pillar_id,
      pillar_name,
      pillar_position,
      score
    )
    values (
      org_id,
      official_result_id,
      pillar_row.pillar_id,
      pillar_row.pillar_name,
      pillar_row.pillar_position,
      pillar_row.score
    );
  end loop;

  update public.maturity_assessments
  set status = 'published',
      published_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_assessment_id;

  update public.template_submissions submission_row
  set status = 'completed',
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where submission_row.organisation_id = org_id
    and submission_row.id = target_submission_id
    and submission_row.status = 'draft';

  perform private.append_maturity_assessment_transition(
    org_id,
    target_assessment_id,
    current_status,
    'published',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.result.published',
    target_assessment_id,
    'succeeded',
    jsonb_build_object(
      'assessment_id', target_assessment_id,
      'official_result_id', official_result_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_assessment_id,
    'OfficialMaturityResultPublished',
    official_result_id::text,
    jsonb_build_object(
      'assessment_id', target_assessment_id,
      'official_result_id', official_result_id
    )
  );

  return official_result_id;
end;
$$;

alter function private.publish_official_maturity_result(uuid)
  owner to lean_hub_private_owner;
