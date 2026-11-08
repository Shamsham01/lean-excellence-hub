-- BILLING-11: Recognition mutation plan gates.

create or replace function private.award_recognition(
  target_recognition_type_id uuid,
  target_title text,
  target_message text,
  target_organisational_unit_id uuid,
  target_visibility text,
  target_recipient_membership_ids uuid[],
  target_source_resource_id uuid default null,
  target_contribution_summaries text[] default null
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
  type_row public.recognition_types%rowtype;
  new_award_id uuid;
  recipient_id uuid;
  idx integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'recognition award is not authorised' using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('recognition');

  if target_recipient_membership_ids is null or array_length(target_recipient_membership_ids, 1) is null then
    raise exception 'recipients are required' using errcode = '22023';
  end if;
  select type_table.* into type_row from public.recognition_types type_table
  where type_table.organisation_id = org_id and type_table.id = target_recognition_type_id and type_table.status = 'active';
  if not found then raise exception 'recognition type not found' using errcode = 'P0002'; end if;
  if not private.has_scoped_permission(org_id, 'recognition.award', null, null)
    and not private.has_scoped_permission(org_id, 'recognition.award', null, target_organisational_unit_id) then
    raise exception 'recognition award is not authorised' using errcode = '42501';
  end if;
  foreach recipient_id in array target_recipient_membership_ids loop
    if not private.has_scoped_permission(org_id, 'recognition.award', recipient_id, null)
      and not private.has_scoped_permission(org_id, 'recognition.award', null, target_organisational_unit_id) then
      raise exception 'recognition award scope does not cover recipient' using errcode = '42501';
    end if;
  end loop;
  if target_source_resource_id is not null
    and not private.can_access_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not readable' using errcode = '42501';
  end if;
  new_award_id := private.register_resource_record(org_id, 'recognition_award', gen_random_uuid(), actor_membership_id);
  insert into public.recognition_awards (
    id, organisation_id, recognition_type_id, recognition_type_name_snapshot,
    title, message, awarded_by_membership_id, organisational_unit_id,
    source_resource_id, visibility, status
  ) values (
    new_award_id, org_id, target_recognition_type_id, type_row.name,
    btrim(target_title), btrim(target_message), actor_membership_id,
    target_organisational_unit_id, target_source_resource_id, target_visibility, 'active'
  );
  idx := 1;
  foreach recipient_id in array target_recipient_membership_ids loop
    insert into public.recognition_recipients (
      organisation_id, recognition_award_id, membership_id,
      contribution_summary
    ) values (
      org_id, new_award_id, recipient_id,
      case when target_contribution_summaries is not null then target_contribution_summaries[idx] else null end
    );
    idx := idx + 1;
  end loop;
  perform private.append_business_audit(org_id, 'recognition.awarded', new_award_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, new_award_id, 'RecognitionAwarded', new_award_id::text, '{}'::jsonb);
  return new_award_id;
end;
$$;

create or replace function private.revoke_recognition(target_award_id uuid, target_reason text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  award_row public.recognition_awards%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'recognition revoke is not authorised' using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('recognition');

  select award_table.* into award_row from public.recognition_awards award_table
  where award_table.organisation_id = org_id and award_table.id = target_award_id for update;
  if not found then raise exception 'recognition award not found' using errcode = 'P0002'; end if;
  if award_row.status = 'revoked' then
    raise exception 'recognition award is already revoked' using errcode = '55000';
  end if;
  if not private.has_scoped_permission(org_id, 'recognition.manage', null, null)
    and not private.has_scoped_permission(org_id, 'recognition.manage', null, award_row.organisational_unit_id) then
    raise exception 'recognition revoke is not authorised' using errcode = '42501';
  end if;
  insert into public.recognition_revocations (
    organisation_id, recognition_award_id, revoked_by_membership_id, reason
  ) values (org_id, target_award_id, actor_membership_id, btrim(target_reason));
  update public.recognition_awards set status = 'revoked'
  where organisation_id = org_id and id = target_award_id;
  perform private.append_business_audit(org_id, 'recognition.revoked', target_award_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_award_id, 'RecognitionRevoked', target_award_id::text, '{}'::jsonb);
  return true;
end;
$$;

create or replace function private.create_recognition_type(
  target_name text,
  target_code text,
  target_description text default null
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
  new_type_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'recognition type creation is not authorised' using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('recognition');

  if not private.has_scoped_permission(org_id, 'recognition.manage', null, null) then
    raise exception 'recognition type creation is not authorised' using errcode = '42501';
  end if;
  insert into public.recognition_types (
    organisation_id, name, code, description, created_by_membership_id
  ) values (org_id, btrim(target_name), btrim(target_code), target_description, actor_membership_id)
  returning id into new_type_id;
  return new_type_id;
end;
$$;
