-- Milestone 10: convenience RPCs to create benefit drafts from CI projects and suggestions.

create or replace function private.can_create_benefit_in_unit(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.create',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.create',
    null,
    target_unit_id
  )
$$;

create or replace function private.build_benefit_description_from_ci_project(
  target_problem_statement text,
  target_objective text,
  target_expected_impact_summary text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    concat_ws(
      E'\n\n',
      case
        when target_problem_statement is not null
          then 'Problem: ' || target_problem_statement
      end,
      case
        when target_objective is not null
          then 'Objective: ' || target_objective
      end,
      case
        when target_expected_impact_summary is not null
          then 'Expected impact: ' || target_expected_impact_summary
      end
    ),
    ''
  )
$$;

create or replace function private.build_benefit_description_from_suggestion(
  target_problem_or_opportunity text,
  target_proposed_idea text,
  target_expected_benefit_summary text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    concat_ws(
      E'\n\n',
      case
        when target_problem_or_opportunity is not null
          then 'Problem or opportunity: ' || target_problem_or_opportunity
      end,
      case
        when target_proposed_idea is not null
          then 'Proposed idea: ' || target_proposed_idea
      end,
      case
        when target_expected_benefit_summary is not null
          then 'Expected benefit: ' || target_expected_benefit_summary
      end
    ),
    ''
  )
$$;

create or replace function private.create_benefit_from_ci_project(
  target_project_id uuid,
  target_benefit_class text,
  target_title text default null,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null
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
  project_row public.ci_projects%rowtype;
  resolved_unit_id uuid;
  resolved_title text;
  resolved_description text;
  resolved_owner_membership_id uuid;
  new_benefit_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit creation from project is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_ci_project(org_id, target_project_id) then
    raise exception 'benefit creation from project is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  resolved_unit_id := coalesce(target_organisational_unit_id, project_row.unit_id);

  if not private.can_create_benefit_in_unit(org_id, resolved_unit_id) then
    raise exception 'benefit creation from project is not authorised'
      using errcode = '42501';
  end if;

  resolved_title := coalesce(nullif(btrim(target_title), ''), project_row.title);
  resolved_description := coalesce(
    target_description,
    private.build_benefit_description_from_ci_project(
      project_row.problem_statement,
      project_row.objective,
      project_row.expected_impact_summary
    )
  );
  resolved_owner_membership_id := coalesce(
    target_owner_membership_id,
    project_row.created_by_membership_id
  );

  new_benefit_id := private.create_benefit_draft(
    resolved_title,
    resolved_unit_id,
    target_benefit_class,
    resolved_description,
    target_financial_type,
    target_non_financial_type,
    target_category_id,
    resolved_owner_membership_id,
    false,
    target_project_id
  );

  perform private.append_business_audit(
    org_id,
    'benefit.created_from_ci_project',
    new_benefit_id,
    'succeeded',
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'project_id', target_project_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    new_benefit_id,
    'BenefitCreatedFromCiProject',
    new_benefit_id::text,
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'project_id', target_project_id
    )
  );

  return new_benefit_id;
end;
$$;

create or replace function private.create_benefit_from_suggestion(
  target_suggestion_id uuid,
  target_benefit_class text,
  target_title text default null,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null
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
  suggestion_row public.improvement_suggestions%rowtype;
  resolved_unit_id uuid;
  resolved_title text;
  resolved_description text;
  resolved_owner_membership_id uuid;
  new_benefit_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit creation from suggestion is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'benefit creation from suggestion is not authorised'
      using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  if suggestion_row.status not in ('accepted', 'implementing', 'implemented') then
    raise exception 'suggestion is not eligible for benefit creation'
      using errcode = '55000';
  end if;

  resolved_unit_id := coalesce(
    target_organisational_unit_id,
    suggestion_row.target_unit_id,
    suggestion_row.origin_unit_id
  );

  if not private.can_create_benefit_in_unit(org_id, resolved_unit_id) then
    raise exception 'benefit creation from suggestion is not authorised'
      using errcode = '42501';
  end if;

  resolved_title := coalesce(nullif(btrim(target_title), ''), suggestion_row.title);
  resolved_description := coalesce(
    target_description,
    private.build_benefit_description_from_suggestion(
      suggestion_row.problem_or_opportunity,
      suggestion_row.proposed_idea,
      suggestion_row.expected_benefit_summary
    )
  );
  resolved_owner_membership_id := coalesce(
    target_owner_membership_id,
    suggestion_row.author_membership_id
  );

  new_benefit_id := private.create_benefit_draft(
    resolved_title,
    resolved_unit_id,
    target_benefit_class,
    resolved_description,
    target_financial_type,
    target_non_financial_type,
    target_category_id,
    resolved_owner_membership_id,
    false,
    target_suggestion_id
  );

  perform private.append_business_audit(
    org_id,
    'benefit.created_from_suggestion',
    new_benefit_id,
    'succeeded',
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'suggestion_id', target_suggestion_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    new_benefit_id,
    'BenefitCreatedFromSuggestion',
    new_benefit_id::text,
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'suggestion_id', target_suggestion_id
    )
  );

  return new_benefit_id;
end;
$$;

create or replace function public.create_benefit_from_ci_project(
  target_project_id uuid,
  target_benefit_class text,
  target_title text default null,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_benefit_from_ci_project(
  target_project_id,
  target_benefit_class,
  target_title,
  target_description,
  target_financial_type,
  target_non_financial_type,
  target_category_id,
  target_organisational_unit_id,
  target_owner_membership_id
) $$;

create or replace function public.create_benefit_from_suggestion(
  target_suggestion_id uuid,
  target_benefit_class text,
  target_title text default null,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_benefit_from_suggestion(
  target_suggestion_id,
  target_benefit_class,
  target_title,
  target_description,
  target_financial_type,
  target_non_financial_type,
  target_category_id,
  target_organisational_unit_id,
  target_owner_membership_id
) $$;

grant execute on function public.create_benefit_from_ci_project(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) to authenticated;
grant execute on function public.create_benefit_from_suggestion(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) to authenticated;

revoke all on function private.can_create_benefit_in_unit(uuid, uuid) from public;
revoke all on function private.build_benefit_description_from_ci_project(text, text, text) from public;
revoke all on function private.build_benefit_description_from_suggestion(text, text, text) from public;
revoke all on function private.create_benefit_from_ci_project(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) from public;
revoke all on function private.create_benefit_from_suggestion(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) from public;

grant execute on function private.can_create_benefit_in_unit(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.build_benefit_description_from_ci_project(text, text, text)
  to lean_hub_private_owner;
grant execute on function private.build_benefit_description_from_suggestion(text, text, text)
  to lean_hub_private_owner;
grant execute on function private.create_benefit_from_ci_project(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) to lean_hub_private_owner;
grant execute on function private.create_benefit_from_suggestion(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) to lean_hub_private_owner;

alter function private.can_create_benefit_in_unit(uuid, uuid) owner to lean_hub_private_owner;
alter function private.build_benefit_description_from_ci_project(text, text, text)
  owner to lean_hub_private_owner;
alter function private.build_benefit_description_from_suggestion(text, text, text)
  owner to lean_hub_private_owner;
alter function private.create_benefit_from_ci_project(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) owner to lean_hub_private_owner;
alter function private.create_benefit_from_suggestion(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) owner to lean_hub_private_owner;
