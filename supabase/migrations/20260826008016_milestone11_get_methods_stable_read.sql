-- Remove side-effecting provisioning from the methods read RPC so STABLE semantics are correct.
-- Built-in methods remain provisioned via provision_organisation and ensure_problem_solving_methods_provisioned.

create or replace function public.get_problem_solving_methods()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  items jsonb;
begin
  if org_id is null then
    raise exception 'problem solving methods list is not authorised'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'code', m.code,
        'description', m.description,
        'is_builtin', m.is_builtin,
        'status', m.status,
        'created_at', m.created_at,
        'current_version', (
          select jsonb_build_object(
            'id', mv.id,
            'version_number', mv.version_number,
            'status', mv.status,
            'stages', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', ms.id,
                    'title', ms.title,
                    'semantic_stage_key', ms.semantic_stage_key,
                    'description', ms.description,
                    'display_order', ms.display_order
                  )
                  order by ms.display_order
                )
                from public.problem_solving_method_stages ms
                where ms.organisation_id = org_id
                  and ms.method_version_id = mv.id
              ),
              '[]'::jsonb
            )
          )
          from public.problem_solving_method_versions mv
          where mv.organisation_id = org_id
            and mv.method_id = m.id
            and mv.status = 'published'
          order by mv.version_number desc
          limit 1
        )
      )
      order by
        case when m.is_builtin then 0 else 1 end,
        m.name
    ),
    '[]'::jsonb
  )
  into items
  from public.problem_solving_methods m
  where m.organisation_id = org_id
    and m.status = 'active';

  return jsonb_build_object('items', items);
end;
$$;
