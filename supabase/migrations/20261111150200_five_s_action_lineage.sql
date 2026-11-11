-- 5S question-scoped action lineage for planner UI and filters.

create or replace function private.five_s_action_lineage(
  target_org_id uuid,
  target_action_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context_row public.five_s_action_context%rowtype;
  audit_row public.five_s_audits%rowtype;
  question_prompt text;
  section_title text;
  chip_label text;
  audit_href text;
begin
  if target_org_id is null or target_action_id is null then
    return null;
  end if;

  select context_table.*
  into context_row
  from public.five_s_action_context context_table
  where context_table.organisation_id = target_org_id
    and context_table.action_id = target_action_id;

  if not found then
    return null;
  end if;

  select audit_table.*
  into audit_row
  from public.five_s_audits audit_table
  where audit_table.organisation_id = target_org_id
    and audit_table.id = context_row.audit_id;

  if not found then
    return null;
  end if;

  if context_row.question_id is not null then
    select question_row.prompt
    into question_prompt
    from public.template_questions question_row
  join public.five_s_standard_versions version_row
    on version_row.id = audit_row.standard_version_id
   and version_row.organisation_id = target_org_id
    where question_row.organisation_id = target_org_id
      and question_row.template_version_id = version_row.template_version_id
      and question_row.id = context_row.question_id;
  end if;

  if context_row.section_id is not null then
    select section_row.title
    into section_title
    from public.template_sections section_row
  join public.five_s_standard_versions version_row
    on version_row.id = audit_row.standard_version_id
   and version_row.organisation_id = target_org_id
    where section_row.organisation_id = target_org_id
      and section_row.template_version_id = version_row.template_version_id
      and section_row.id = context_row.section_id;
  end if;

  chip_label := format(
    'From 5S audit: %s · %s - Q: %s',
    coalesce(nullif(btrim(audit_row.standard_name_snapshot), ''), '5S audit'),
    coalesce(nullif(btrim(audit_row.unit_name_snapshot), ''), 'Site'),
    coalesce(nullif(btrim(question_prompt), ''), 'Question')
  );

  audit_href := format('/platform/5s/audits/%s', context_row.audit_id);

  return jsonb_build_object(
    'audit_id', context_row.audit_id,
    'section_id', context_row.section_id,
    'question_id', context_row.question_id,
    'finding_id', context_row.finding_id,
    'standard_name', audit_row.standard_name_snapshot,
    'unit_name', audit_row.unit_name_snapshot,
    'completed_at', audit_row.completed_at,
    'question_prompt', question_prompt,
    'section_title', section_title,
    'chip_label', chip_label,
    'audit_href', audit_href
  );
end;
$$;

create or replace function public.get_five_s_action_lineage(
  target_action_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_read_action(org_id, target_action_id) then
    raise exception '5S action lineage is not authorised'
      using errcode = '42501';
  end if;

  return private.five_s_action_lineage(org_id, target_action_id);
end;
$$;

create or replace function public.list_five_s_audits_for_action_filter()
returns table (
  audit_id uuid,
  label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null then
    raise exception 'organisation context is required'
      using errcode = '42501';
  end if;

  return query
  select
    audit_row.id,
    format(
      '%s · %s%s',
      coalesce(nullif(btrim(audit_row.standard_name_snapshot), ''), '5S audit'),
      coalesce(nullif(btrim(audit_row.unit_name_snapshot), ''), 'Site'),
      case
        when audit_row.completed_at is null then ''
        else format(' (%s)', to_char(audit_row.completed_at at time zone 'UTC', 'YYYY-MM-DD'))
      end
    )
  from public.five_s_audits audit_row
  where audit_row.organisation_id = org_id
    and exists (
      select 1
      from public.five_s_action_context context_row
      where context_row.organisation_id = org_id
        and context_row.audit_id = audit_row.id
    )
  order by audit_row.completed_at desc nulls last, audit_row.created_at desc;
end;
$$;

create or replace function public.list_five_s_audit_linked_actions(
  target_audit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  result jsonb;
begin
  if org_id is null
    or not private.can_read_five_s_audit(org_id, target_audit_id) then
    raise exception '5S linked actions are not authorised'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'action_id', context_row.action_id,
        'question_id', context_row.question_id,
        'status', action_row.status,
        'title', action_row.title,
        'href', format('/platform/actions?action=%s', context_row.action_id)
      )
      order by action_row.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from public.five_s_action_context context_row
  join public.actions action_row
    on action_row.organisation_id = context_row.organisation_id
   and action_row.id = context_row.action_id
  where context_row.organisation_id = org_id
    and context_row.audit_id = target_audit_id;

  return coalesce(result, '[]'::jsonb);
end;
$$;

grant execute on function public.get_five_s_action_lineage(uuid) to authenticated;
grant execute on function public.list_five_s_audits_for_action_filter() to authenticated;
grant execute on function public.list_five_s_audit_linked_actions(uuid) to authenticated;
