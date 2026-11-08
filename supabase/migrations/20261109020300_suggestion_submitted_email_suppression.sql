-- Suppress stale SuggestionSubmitted email when routing generation advanced (e.g. after delegation).

create or replace function public.lookup_suggestion_approval_notification_recipients_for_worker(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when routing_row.email_recipient_membership_id is null then '{}'::uuid[]
    when routing_row.notification_generation > 1 then '{}'::uuid[]
    when routing_row.task_owner_membership_id is distinct from routing_row.email_recipient_membership_id
      then '{}'::uuid[]
    else array[routing_row.email_recipient_membership_id]
  end
  from public.suggestion_approval_routing routing_row
  join public.improvement_suggestions suggestion_row
    on suggestion_row.organisation_id = routing_row.organisation_id
   and suggestion_row.id = routing_row.suggestion_id
  where routing_row.organisation_id = target_organisation_id
    and routing_row.suggestion_id = target_suggestion_id
    and suggestion_row.status = 'submitted'
$$;

create or replace function private.submit_suggestion(target_suggestion_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  programme_row public.suggestion_programmes%rowtype;
  category_row public.suggestion_categories%rowtype;
  origin_unit_row public.organisation_units%rowtype;
  target_unit_row public.organisation_units%rowtype;
  programme_version_row public.suggestion_programme_versions%rowtype;
  submission_version_id uuid;
  allocated_suggestion_number text;
  review_jurisdiction uuid;
  snapshotted_generation integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found or suggestion_row.status <> 'draft' then
    raise exception 'suggestion is not submittable' using errcode = '55000';
  end if;

  if suggestion_row.author_membership_id <> actor_membership_id then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  if not private.can_submit_suggestion_to_unit(org_id, suggestion_row.origin_unit_id) then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select version_table.*
  into programme_version_row
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = suggestion_row.programme_version_id
    and version_table.lifecycle = 'published';

  if not found then
    raise exception 'programme version is not published' using errcode = '22023';
  end if;

  select programme_table.* into programme_row
  from public.suggestion_programmes programme_table
  where programme_table.organisation_id = org_id
    and programme_table.id = programme_version_row.programme_id;

  if programme_row.status <> 'active' then
    raise exception 'programme is not active for submission' using errcode = '22023';
  end if;

  select category_table.* into category_row
  from public.suggestion_categories category_table
  where category_table.organisation_id = org_id
    and category_table.id = suggestion_row.category_id;

  if category_row.status <> 'active' then
    raise exception 'category is not active for submission' using errcode = '22023';
  end if;

  select unit_table.* into origin_unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = suggestion_row.origin_unit_id;

  if suggestion_row.target_unit_id is not null then
    select unit_table.* into target_unit_row
    from public.organisation_units unit_table
    where unit_table.organisation_id = org_id
      and unit_table.id = suggestion_row.target_unit_id;
  end if;

  if programme_version_row.template_version_id is not null then
    if suggestion_row.template_submission_id is null then
      raise exception 'template submission is required' using errcode = '22023';
    end if;

    select submission_table.template_version_id
    into submission_version_id
    from public.template_submissions submission_table
    where submission_table.organisation_id = org_id
      and submission_table.id = suggestion_row.template_submission_id;

    if submission_version_id is distinct from programme_version_row.template_version_id then
      raise exception 'template submission does not match programme template version' using errcode = '22023';
    end if;

    perform private.complete_template_submission(suggestion_row.template_submission_id);
  end if;

  allocated_suggestion_number := private.allocate_organisation_document_number(
    org_id, 'improvement_suggestion', 'IDEA'
  );

  review_jurisdiction := coalesce(suggestion_row.target_unit_id, suggestion_row.origin_unit_id);

  update public.improvement_suggestions suggestion_table
  set status = 'submitted',
      suggestion_number = allocated_suggestion_number,
      programme_name_snapshot = programme_row.name,
      programme_code_snapshot = programme_row.code,
      category_name_snapshot = category_row.name,
      category_code_snapshot = category_row.code,
      origin_unit_name_snapshot = origin_unit_row.name,
      origin_unit_code_snapshot = origin_unit_row.code,
      target_unit_name_snapshot = target_unit_row.name,
      target_unit_code_snapshot = target_unit_row.code,
      review_jurisdiction_unit_id = review_jurisdiction,
      submitted_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  perform private.snapshot_suggestion_approval_routing(
    org_id,
    target_suggestion_id,
    review_jurisdiction,
    suggestion_row.author_membership_id
  );

  select routing_row.notification_generation
  into snapshotted_generation
  from public.suggestion_approval_routing routing_row
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = target_suggestion_id;

  perform private.append_suggestion_status_history(
    org_id, target_suggestion_id, 'draft', 'submitted', actor_membership_id, 'submitted'
  );

  perform private.append_business_audit(org_id, 'suggestion.submitted', target_suggestion_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionSubmitted',
    target_suggestion_id::text,
    jsonb_build_object(
      'notification_generation', coalesce(snapshotted_generation, 1)
    )
  );

  return true;
end;
$$;
