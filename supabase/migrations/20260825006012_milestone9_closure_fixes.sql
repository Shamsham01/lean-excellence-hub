-- Milestone 9 closure: self-scope submit catalogue access, overview auth alignment, programme successor RPC.

-- Allow operators with self-scoped suggestions.submit to read programme catalogue for submission.
drop policy if exists suggestion_programme_versions_select on public.suggestion_programme_versions;
create policy suggestion_programme_versions_select
on public.suggestion_programme_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_manage_suggestion_programmes(organisation_id)
    or private.has_scoped_permission(organisation_id, 'suggestions.read', null, null)
    or private.has_scoped_permission(organisation_id, 'suggestions.submit', null, null)
    or private.has_scoped_permission(
      organisation_id,
      'suggestions.read',
      private.current_membership_id(organisation_id),
      null
    )
    or private.has_scoped_permission(
      organisation_id,
      'suggestions.submit',
      private.current_membership_id(organisation_id),
      null
    )
    or private.has_scoped_permission(organisation_id, 'suggestions.review', null, null)
  )
);

drop policy if exists suggestion_categories_select on public.suggestion_categories;
create policy suggestion_categories_select
on public.suggestion_categories for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_manage_suggestion_programmes(organisation_id)
    or private.has_scoped_permission(organisation_id, 'suggestions.read', null, null)
    or private.has_scoped_permission(organisation_id, 'suggestions.submit', null, null)
    or private.has_scoped_permission(
      organisation_id,
      'suggestions.read',
      private.current_membership_id(organisation_id),
      null
    )
    or private.has_scoped_permission(
      organisation_id,
      'suggestions.submit',
      private.current_membership_id(organisation_id),
      null
    )
    or private.has_scoped_permission(organisation_id, 'suggestions.review', null, null)
  )
);

drop policy if exists suggestion_programmes_select on public.suggestion_programmes;
create policy suggestion_programmes_select
on public.suggestion_programmes for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_manage_suggestion_programmes(organisation_id)
    or private.has_scoped_permission(organisation_id, 'suggestions.read', null, null)
    or private.has_scoped_permission(organisation_id, 'suggestions.submit', null, null)
    or private.has_scoped_permission(
      organisation_id,
      'suggestions.read',
      private.current_membership_id(organisation_id),
      null
    )
    or private.has_scoped_permission(
      organisation_id,
      'suggestions.submit',
      private.current_membership_id(organisation_id),
      null
    )
    or private.has_scoped_permission(organisation_id, 'suggestions.review', null, null)
  )
);

create or replace function public.get_suggestions_overview()
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
  if org_id is null then
    raise exception 'suggestions overview is not authorised'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'submitted_this_month', count(*) filter (
      where suggestion_row.submitted_at >= date_trunc('month', statement_timestamp())
    ),
    'awaiting_review', count(*) filter (
      where suggestion_row.status in ('submitted', 'under_review')
    ),
    'accepted', count(*) filter (where suggestion_row.status = 'accepted'),
    'implementing', count(*) filter (where suggestion_row.status = 'implementing'),
    'implemented', count(*) filter (where suggestion_row.status = 'implemented'),
    'pipeline', jsonb_build_object(
      'submitted', count(*) filter (where suggestion_row.status = 'submitted'),
      'under_review', count(*) filter (where suggestion_row.status = 'under_review'),
      'accepted', count(*) filter (where suggestion_row.status = 'accepted'),
      'implementing', count(*) filter (where suggestion_row.status = 'implementing'),
      'implemented', count(*) filter (where suggestion_row.status = 'implemented')
    )
  )
  into result
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = org_id
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id);

  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function private.create_suggestion_programme_successor_version(
  target_programme_id uuid
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
  published_version public.suggestion_programme_versions%rowtype;
  new_version_id uuid;
  next_version_number integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'programme successor creation is not authorised'
      using errcode = '42501';
  end if;

  select version_table.*
  into published_version
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.programme_id = target_programme_id
    and version_table.lifecycle = 'published'
  order by version_table.version_number desc
  limit 1
  for update;

  if not found then
    raise exception 'published programme version is required for successor'
      using errcode = '55000';
  end if;

  select coalesce(max(version_table.version_number), 0) + 1
  into next_version_number
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.programme_id = target_programme_id;

  new_version_id := gen_random_uuid();

  insert into public.suggestion_programme_versions (
    id,
    organisation_id,
    programme_id,
    version_number,
    lifecycle,
    review_target_days,
    applicable_unit_id,
    template_version_id,
    created_by_membership_id
  )
  values (
    new_version_id,
    org_id,
    target_programme_id,
    next_version_number,
    'draft',
    published_version.review_target_days,
    published_version.applicable_unit_id,
    published_version.template_version_id,
    actor_membership_id
  );

  return new_version_id;
end;
$$;

create or replace function public.create_suggestion_programme_successor_version(
  target_programme_id uuid
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_suggestion_programme_successor_version(target_programme_id)
$$;

grant execute on function public.create_suggestion_programme_successor_version(uuid) to authenticated;
alter function private.create_suggestion_programme_successor_version(uuid)
  owner to lean_hub_private_owner;
