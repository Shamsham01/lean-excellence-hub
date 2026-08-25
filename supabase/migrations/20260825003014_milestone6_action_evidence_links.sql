create or replace function private.link_five_s_evidence(
  target_audit_id uuid,
  target_attachment_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_finding_id uuid default null
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
    or not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S evidence link is not authorised'
      using errcode = '42501';
  end if;

  insert into public.five_s_evidence_links (
    organisation_id, audit_id, attachment_id, section_id, question_id, finding_id, created_by_membership_id
  )
  values (
    org_id, target_audit_id, target_attachment_id, target_section_id, target_question_id, target_finding_id, actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

create or replace function private.create_five_s_action(
  target_title text,
  target_audit_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_finding_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
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
    or not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  select audit_row.unit_id into unit_id
  from public.five_s_audits audit_row
  where audit_row.organisation_id = org_id and audit_row.id = target_audit_id;

  new_action_id := private.create_action(
    target_title, target_description, target_priority, unit_id, target_audit_id, target_due_at, null
  );

  insert into public.five_s_action_context (
    organisation_id, action_id, audit_id, section_id, question_id, finding_id, created_by_membership_id
  )
  values (
    org_id, new_action_id, target_audit_id, target_section_id, target_question_id, target_finding_id, actor_membership_id
  );

  return new_action_id;
end;
$$;

create or replace function private.link_gemba_evidence(
  target_walk_id uuid,
  target_attachment_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null
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
  if not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba evidence link is not authorised'
      using errcode = '42501';
  end if;

  insert into public.gemba_evidence_links (
    organisation_id, walk_id, attachment_id, section_id, question_id, observation_id, created_by_membership_id
  )
  values (
    org_id, target_walk_id, target_attachment_id, target_section_id, target_question_id, target_observation_id, actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

create or replace function private.create_gemba_action(
  target_title text,
  target_walk_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
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
  if not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  select walk_row.unit_id into unit_id
  from public.gemba_walks walk_row
  where walk_row.organisation_id = org_id and walk_row.id = target_walk_id;

  new_action_id := private.create_action(
    target_title, target_description, target_priority, unit_id, target_walk_id, target_due_at, null
  );

  insert into public.gemba_action_context (
    organisation_id, action_id, walk_id, section_id, question_id, observation_id, created_by_membership_id
  )
  values (
    org_id, new_action_id, target_walk_id, target_section_id, target_question_id, target_observation_id, actor_membership_id
  );

  return new_action_id;
end;
$$;

create or replace function public.link_five_s_evidence(
  target_audit_id uuid,
  target_attachment_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_finding_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.link_five_s_evidence(
  target_audit_id, target_attachment_id, target_section_id, target_question_id, target_finding_id
) $$;

create or replace function public.create_five_s_action(
  target_title text,
  target_audit_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_finding_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_five_s_action(
  target_title, target_audit_id, target_section_id, target_question_id, target_finding_id,
  target_description, target_priority, target_due_at
) $$;

create or replace function public.link_gemba_evidence(
  target_walk_id uuid,
  target_attachment_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.link_gemba_evidence(
  target_walk_id, target_attachment_id, target_section_id, target_question_id, target_observation_id
) $$;

create or replace function public.create_gemba_action(
  target_title text,
  target_walk_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_gemba_action(
  target_title, target_walk_id, target_section_id, target_question_id, target_observation_id,
  target_description, target_priority, target_due_at
) $$;

grant execute on function public.link_five_s_evidence(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.create_five_s_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
) to authenticated;
grant execute on function public.link_gemba_evidence(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.create_gemba_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
) to authenticated;
