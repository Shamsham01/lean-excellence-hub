-- Site-scoped 5S auditors can save answers on an audit they are allowed to
-- perform. private.upsert_template_answer still requires organisation-wide
-- submissions.create, which a unit_subtree grant cannot satisfy. This writer
-- authorises the exact audit and question, then writes that audit's own
-- draft submission. It does not accept a caller-supplied submission id and
-- does not weaken the shared template writer.

create or replace function private.upsert_five_s_audit_answer(
  target_audit_id uuid,
  target_question_id uuid,
  target_is_not_applicable boolean default false,
  target_text_value text default null,
  target_number_value numeric default null,
  target_date_value date default null,
  target_json_value jsonb default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  target_submission_id uuid;
  submission_status text;
  submission_version_id uuid;
  audit_template_version_id uuid;
  question_type text;
  version_scale jsonb;
  answer_id uuid;
begin
  if not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S audit answer upsert is not authorised'
      using errcode = '42501';
  end if;

  select
    audit_row.submission_id,
    submission_row.status,
    submission_row.template_version_id,
    standard_version.template_version_id,
    question_row.question_type,
    standard_version.scoring_scale
  into
    target_submission_id,
    submission_status,
    submission_version_id,
    audit_template_version_id,
    question_type,
    version_scale
  from public.five_s_audits audit_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = audit_row.organisation_id
   and standard_version.id = audit_row.standard_version_id
  join public.template_submissions submission_row
    on submission_row.organisation_id = audit_row.organisation_id
   and submission_row.id = audit_row.submission_id
  left join public.template_questions question_row
    on question_row.organisation_id = standard_version.organisation_id
   and question_row.id = target_question_id
   and question_row.template_version_id = standard_version.template_version_id
  where audit_row.organisation_id = org_id
    and audit_row.id = target_audit_id;

  if target_submission_id is null
    or submission_version_id is distinct from audit_template_version_id then
    raise exception '5S audit answer upsert is not authorised'
      using errcode = '42501';
  end if;

  if submission_status is distinct from 'draft' then
    raise exception 'submission is not editable'
      using errcode = '55000';
  end if;

  if question_type is null then
    raise exception 'question does not belong to audit template version'
      using errcode = '23503';
  end if;

  if not coalesce(target_is_not_applicable, false)
    and question_type in ('score', 'number', 'percentage')
    and (
      target_number_value is null
      or not private.five_s_score_is_on_scale(
        target_number_value,
        private.five_s_resolve_scoring_scale(version_scale)
      )
    ) then
    raise exception '5S score is not on the published scale'
      using errcode = '22023';
  end if;

  insert into public.template_answers (
    organisation_id,
    submission_id,
    question_id,
    is_not_applicable,
    text_value,
    number_value,
    date_value,
    json_value,
    updated_at
  )
  values (
    org_id,
    target_submission_id,
    target_question_id,
    coalesce(target_is_not_applicable, false),
    target_text_value,
    target_number_value,
    target_date_value,
    target_json_value,
    statement_timestamp()
  )
  on conflict (organisation_id, submission_id, question_id)
  do update
  set is_not_applicable = excluded.is_not_applicable,
      text_value = excluded.text_value,
      number_value = excluded.number_value,
      date_value = excluded.date_value,
      json_value = excluded.json_value,
      updated_at = statement_timestamp()
  returning id into answer_id;

  return answer_id;
end;
$$;

alter function private.upsert_five_s_audit_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) owner to lean_hub_private_owner;

revoke all on function private.upsert_five_s_audit_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) from public, anon, authenticated;

grant execute on function private.upsert_five_s_audit_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) to lean_hub_private_owner;
