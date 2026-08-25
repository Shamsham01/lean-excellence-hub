-- Capability gap actions via Universal Actions.

create table public.capability_action_context (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  gap_type text not null,
  membership_id uuid not null,
  course_id uuid,
  skill_id uuid,
  training_completion_id uuid,
  skill_assessment_id uuid,
  notes text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint capability_action_context_organisation_id_id_key unique (organisation_id, id),
  constraint capability_action_context_action_key unique (organisation_id, action_id),
  constraint capability_action_context_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint capability_action_context_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint capability_action_context_course_fkey
    foreign key (organisation_id, course_id)
    references public.training_courses(organisation_id, id)
    on delete restrict,
  constraint capability_action_context_skill_fkey
    foreign key (organisation_id, skill_id)
    references public.skills(organisation_id, id)
    on delete restrict,
  constraint capability_action_context_training_completion_fkey
    foreign key (organisation_id, training_completion_id)
    references public.training_completions(organisation_id, id)
    on delete restrict,
  constraint capability_action_context_skill_assessment_fkey
    foreign key (organisation_id, skill_assessment_id)
    references public.membership_skill_assessments(organisation_id, id)
    on delete restrict,
  constraint capability_action_context_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint capability_action_context_gap_type_check
    check (
      gap_type in (
        'training_gap',
        'skill_gap',
        'skill_assessment_follow_up'
      )
    ),
  constraint capability_action_context_target_check
    check (
      (gap_type = 'training_gap' and course_id is not null)
      or (gap_type = 'skill_gap' and skill_id is not null)
      or (gap_type = 'skill_assessment_follow_up' and skill_id is not null)
    )
);

create index capability_action_context_membership_idx
  on public.capability_action_context (organisation_id, membership_id);

create trigger capability_action_context_prevent_organisation_id_change
before update on public.capability_action_context
for each row execute function private.prevent_organisation_id_change();

alter table public.capability_action_context enable row level security;
alter table public.capability_action_context force row level security;

revoke all on public.capability_action_context from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.capability_action_context to lean_hub_private_owner;

create policy private_owner_all_capability_action_context
on public.capability_action_context for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.create_capability_action(
  target_title text,
  target_gap_type text,
  target_membership_id uuid,
  target_course_id uuid default null,
  target_skill_id uuid default null,
  target_training_completion_id uuid default null,
  target_skill_assessment_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_notes text default null
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
  unit_id uuid;
  new_action_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'actions.create', null, null) then
    raise exception 'capability action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_gap_type = 'training_gap' then
    if not private.has_scoped_permission(org_id, 'people.capability.read', target_membership_id, null)
      and not private.has_scoped_permission(org_id, 'people.capability.read', null, null) then
      raise exception 'capability action target is not authorised'
        using errcode = '42501';
    end if;
  elsif target_gap_type in ('skill_gap', 'skill_assessment_follow_up') then
    if not private.can_assess_skills(org_id, target_membership_id, null)
      and not private.has_scoped_permission(org_id, 'people.capability.read', null, null) then
      raise exception 'capability action target is not authorised'
        using errcode = '42501';
    end if;
  else
    raise exception 'invalid capability gap type'
      using errcode = '22023';
  end if;

  select assignment_row.organisational_unit_id
  into unit_id
  from public.membership_job_function_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.membership_id = target_membership_id
    and assignment_row.is_primary = true
    and assignment_row.valid_from <= statement_timestamp()
    and (
      assignment_row.valid_to is null
      or assignment_row.valid_to > statement_timestamp()
    )
  limit 1;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    null,
    target_due_at,
    null
  );

  insert into public.capability_action_context (
    organisation_id,
    action_id,
    gap_type,
    membership_id,
    course_id,
    skill_id,
    training_completion_id,
    skill_assessment_id,
    notes,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_gap_type,
    target_membership_id,
    target_course_id,
    target_skill_id,
    target_training_completion_id,
    target_skill_assessment_id,
    target_notes,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

create policy capability_action_context_select
on public.capability_action_context for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_action(organisation_id, action_id)
);

grant select on public.capability_action_context to authenticated;

create or replace function public.create_capability_action(
  target_title text,
  target_gap_type text,
  target_membership_id uuid,
  target_course_id uuid default null,
  target_skill_id uuid default null,
  target_training_completion_id uuid default null,
  target_skill_assessment_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_notes text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_capability_action(
  target_title,
  target_gap_type,
  target_membership_id,
  target_course_id,
  target_skill_id,
  target_training_completion_id,
  target_skill_assessment_id,
  target_description,
  target_priority,
  target_due_at,
  target_notes
) $$;

grant execute on function public.create_capability_action(
  text, text, uuid, uuid, uuid, uuid, uuid, text, text, timestamptz, text
) to authenticated;

revoke all on function public.create_capability_action(
  text, text, uuid, uuid, uuid, uuid, uuid, text, text, timestamptz, text
) from public, anon;

alter function private.create_capability_action(
  text, text, uuid, uuid, uuid, uuid, uuid, text, text, timestamptz, text
) owner to lean_hub_private_owner;
