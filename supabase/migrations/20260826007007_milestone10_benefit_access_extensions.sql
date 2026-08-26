-- Milestone 10: benefit resource access, realisation entry reads, and benefit evidence links.

create or replace function private.can_read_improvement_benefit_by_permission(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = target_organisation_id
      and benefit_row.id = target_benefit_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          null,
          benefit_row.organisational_unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          benefit_row.owner_membership_id,
          null
        )
      )
  )
$$;

create or replace function private.can_read_improvement_benefit(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_improvement_benefit_by_permission(
    target_organisation_id,
    target_benefit_id
  )
  or private.is_active_benefit_validator(
    target_organisation_id,
    target_benefit_id,
    private.current_membership_id(target_organisation_id)
  )
$$;

create or replace function private.can_read_benefit_realisation_entry(
  target_organisation_id uuid,
  target_entry_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.benefit_realisation_entries entry_row
    where entry_row.organisation_id = target_organisation_id
      and entry_row.id = target_entry_id
      and private.can_read_improvement_benefit(
        target_organisation_id,
        entry_row.benefit_id
      )
  )
$$;

create or replace function private.can_link_benefit_evidence(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = target_organisation_id
      and benefit_row.id = target_benefit_id
      and benefit_row.status in ('draft', 'submitted', 'approved', 'realising')
      and (
        private.can_edit_benefit_draft(target_organisation_id, target_benefit_id)
        or private.can_manage_benefit_in_unit(
          target_organisation_id,
          benefit_row.organisational_unit_id
        )
        or private.can_record_benefit_realisation(
          target_organisation_id,
          benefit_row.organisational_unit_id
        )
      )
  )
$$;

create table public.benefit_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  benefit_id uuid not null,
  attachment_id uuid not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint benefit_evidence_links_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_evidence_links_benefit_attachment_key
    unique (organisation_id, benefit_id, attachment_id),
  constraint benefit_evidence_links_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_evidence_links_attachment_fkey
    foreign key (organisation_id, attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint benefit_evidence_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create or replace function private.guard_benefit_child_terminal_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  benefit_status text;
  target_benefit_id uuid;
begin
  target_benefit_id := coalesce(new.benefit_id, old.benefit_id);

  select benefit_row.status
  into benefit_status
  from public.improvement_benefits benefit_row
  where benefit_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and benefit_row.id = target_benefit_id;

  if benefit_status in ('realised', 'withdrawn', 'cancelled', 'rejected') then
    raise exception 'terminal benefit child records are immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger benefit_evidence_links_prevent_org_change
before update on public.benefit_evidence_links
for each row execute function private.prevent_organisation_id_change();

create trigger benefit_evidence_links_guard_terminal_immutable
before update or delete on public.benefit_evidence_links
for each row execute function private.guard_benefit_child_terminal_immutable();

create index benefit_evidence_links_benefit_idx
  on public.benefit_evidence_links (organisation_id, benefit_id);

alter table public.benefit_evidence_links enable row level security;
alter table public.benefit_evidence_links force row level security;

revoke all on public.benefit_evidence_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.benefit_evidence_links to lean_hub_private_owner;

create policy private_owner_all_benefit_evidence_links
on public.benefit_evidence_links for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.link_benefit_evidence(
  target_benefit_id uuid,
  target_attachment_id uuid
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
  new_link_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_link_benefit_evidence(org_id, target_benefit_id) then
    raise exception 'benefit evidence link is not authorised'
      using errcode = '42501';
  end if;

  insert into public.benefit_evidence_links (
    organisation_id,
    benefit_id,
    attachment_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    target_attachment_id,
    actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

create or replace function private.can_access_resource(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_row public.resource_records%rowtype;
begin
  select resource_registry.*
  into resource_row
  from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_resource_id
    and resource_registry.retired_at is null;

  if not found then
    return false;
  end if;

  case resource_row.resource_type
    when 'action' then
      return private.can_read_action(target_organisation_id, target_resource_id);
    when 'template' then
      return private.has_scoped_permission(
        target_organisation_id,
        'templates.read',
        null,
        null
      );
    when 'template_submission' then
      return private.can_read_template_submission(
        target_organisation_id,
        target_resource_id
      );
    when 'attachment' then
      return private.can_access_attachment_target(
        target_organisation_id,
        target_resource_id
      );
    when 'comment' then
      return private.can_access_comment_target(
        target_organisation_id,
        target_resource_id
      );
    when 'maturity_model' then
      return private.can_read_maturity_catalog(target_organisation_id);
    when 'maturity_assessment' then
      return private.can_read_maturity_assessment(
        target_organisation_id,
        target_resource_id
      );
    when 'schedule_definition' then
      return private.can_read_schedule_definition(
        target_organisation_id,
        target_resource_id
      );
    when 'five_s_standard' then
      return private.can_read_five_s_catalog(target_organisation_id);
    when 'five_s_audit' then
      return private.can_read_five_s_audit(
        target_organisation_id,
        target_resource_id
      );
    when 'gemba_definition' then
      return private.can_read_gemba_catalog(target_organisation_id);
    when 'gemba_walk' then
      return private.can_read_gemba_walk(
        target_organisation_id,
        target_resource_id
      );
    when 'training_course' then
      return private.can_read_training_catalog(target_organisation_id);
    when 'training_session' then
      return private.can_read_training_session(
        target_organisation_id,
        target_resource_id
      );
    when 'training_completion' then
      return private.can_read_training_completion(
        target_organisation_id,
        target_resource_id
      );
    when 'skill' then
      return private.can_read_skills_catalog(target_organisation_id);
    when 'skill_assessment' then
      return private.can_read_skill_assessment(
        target_organisation_id,
        target_resource_id
      );
    when 'ci_project' then
      return private.can_read_ci_project(
        target_organisation_id,
        target_resource_id
      );
    when 'improvement_suggestion' then
      return private.can_read_improvement_suggestion(
        target_organisation_id,
        target_resource_id
      );
    when 'recognition_award' then
      return private.can_read_recognition_award(
        target_organisation_id,
        target_resource_id
      );
    when 'improvement_benefit' then
      return private.can_read_improvement_benefit(
        target_organisation_id,
        target_resource_id
      );
    when 'benefit_realisation_entry' then
      return private.can_read_benefit_realisation_entry(
        target_organisation_id,
        target_resource_id
      );
    else
      return false;
  end case;
end;
$$;

create policy benefit_evidence_links_select
on public.benefit_evidence_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

grant select on public.benefit_evidence_links to authenticated;

drop policy if exists benefit_realisation_entries_select on public.benefit_realisation_entries;

create policy benefit_realisation_entries_select
on public.benefit_realisation_entries for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_benefit_realisation_entry(organisation_id, id)
);

create or replace function public.link_benefit_evidence(
  target_benefit_id uuid,
  target_attachment_id uuid
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.link_benefit_evidence(
  target_benefit_id,
  target_attachment_id
) $$;

grant execute on function public.link_benefit_evidence(uuid, uuid) to authenticated;

revoke all on function public.link_benefit_evidence(uuid, uuid) from public, anon;

revoke all on function private.can_read_improvement_benefit_by_permission(uuid, uuid) from public;
revoke all on function private.can_read_benefit_realisation_entry(uuid, uuid) from public;
revoke all on function private.can_link_benefit_evidence(uuid, uuid) from public;
revoke all on function private.link_benefit_evidence(uuid, uuid) from public;

grant execute on function private.can_read_improvement_benefit_by_permission(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_read_benefit_realisation_entry(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_link_benefit_evidence(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.link_benefit_evidence(uuid, uuid) to lean_hub_private_owner;

alter function private.can_read_improvement_benefit_by_permission(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_improvement_benefit(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_benefit_realisation_entry(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_link_benefit_evidence(uuid, uuid) owner to lean_hub_private_owner;
alter function private.guard_benefit_child_terminal_immutable() owner to lean_hub_private_owner;
alter function private.link_benefit_evidence(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_access_resource(uuid, uuid) owner to lean_hub_private_owner;
