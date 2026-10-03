-- First-class question-level assessor notes for maturity assessments.
-- Mirrors maturity_assessment_criterion_notes: tenant isolation, pinned
-- framework membership, edit/review authority, and frozen-assessment
-- immutability.

create table public.maturity_assessment_question_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assessment_id uuid not null,
  question_id uuid not null,
  comment_text text not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint maturity_assessment_question_notes_org_id_key
    unique (organisation_id, id),
  constraint maturity_assessment_question_notes_assessment_question_key
    unique (organisation_id, assessment_id, question_id),
  constraint maturity_assessment_question_notes_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_question_notes_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_question_notes_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_question_notes_comment_check
    check (
      comment_text = btrim(comment_text)
      and char_length(comment_text) between 1 and 8000
    )
);

create index maturity_assessment_question_notes_assessment_idx
  on public.maturity_assessment_question_notes (organisation_id, assessment_id);

create trigger maturity_assessment_question_notes_touch_updated_at
before update on public.maturity_assessment_question_notes
for each row execute function private.touch_updated_at();

create trigger maturity_assessment_question_notes_guard_immutable
before update or delete on public.maturity_assessment_question_notes
for each row execute function private.guard_maturity_assessment_context_immutable();

create or replace function private.upsert_maturity_assessment_question_note(
  target_assessment_id uuid,
  target_question_id uuid,
  target_comment_text text
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
  note_id uuid;
  previous_comment text;
  assessment_status text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity assessment question note upsert is not authorised'
      using errcode = '42501';
  end if;

  if btrim(coalesce(target_comment_text, '')) = '' then
    raise exception 'question comment cannot be empty'
      using errcode = '22023';
  end if;

  select assessment_row.status
  into assessment_status
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id;

  if not exists (
    select 1
    from public.maturity_assessments assessment_row
    join public.maturity_model_versions model_version
      on model_version.organisation_id = assessment_row.organisation_id
     and model_version.id = assessment_row.model_version_id
    join public.template_questions question_row
      on question_row.organisation_id = assessment_row.organisation_id
     and question_row.id = target_question_id
     and question_row.template_version_id = model_version.template_version_id
    join public.maturity_criterion_questions question_link
      on question_link.organisation_id = assessment_row.organisation_id
     and question_link.question_id = question_row.id
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = assessment_row.organisation_id
     and criterion_row.id = question_link.criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
     and pillar_row.model_version_id = model_version.id
    where assessment_row.organisation_id = org_id
      and assessment_row.id = target_assessment_id
  ) then
    raise exception 'question does not belong to assessment framework version'
      using errcode = '23503';
  end if;

  select note_row.comment_text
  into previous_comment
  from public.maturity_assessment_question_notes note_row
  where note_row.organisation_id = org_id
    and note_row.assessment_id = target_assessment_id
    and note_row.question_id = target_question_id;

  insert into public.maturity_assessment_question_notes (
    organisation_id,
    assessment_id,
    question_id,
    comment_text,
    created_by_membership_id
  )
  values (
    org_id,
    target_assessment_id,
    target_question_id,
    btrim(target_comment_text),
    actor_membership_id
  )
  on conflict (organisation_id, assessment_id, question_id)
  do update
  set comment_text = excluded.comment_text,
      updated_at = statement_timestamp()
  returning id into note_id;

  if previous_comment is distinct from btrim(target_comment_text) then
    perform private.append_business_audit(
      org_id,
      'maturity.assessment.question_comment_changed',
      target_assessment_id,
      'succeeded',
      pg_catalog.jsonb_build_object(
        'question_id', target_question_id,
        'previous_comment_text', previous_comment,
        'new_comment_text', btrim(target_comment_text),
        'assessment_status', assessment_status,
        'actor_membership_id', actor_membership_id
      )
    );
  end if;

  return note_id;
end;
$$;

create or replace function public.upsert_maturity_assessment_question_note(
  target_assessment_id uuid,
  target_question_id uuid,
  target_comment_text text
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.upsert_maturity_assessment_question_note(
    target_assessment_id,
    target_question_id,
    target_comment_text
  )
$$;

alter table public.maturity_assessment_question_notes enable row level security;
alter table public.maturity_assessment_question_notes force row level security;

revoke all on public.maturity_assessment_question_notes
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.maturity_assessment_question_notes
  to lean_hub_private_owner;
create policy private_owner_all_maturity_assessment_question_notes
on public.maturity_assessment_question_notes for all to lean_hub_private_owner
using (true) with check (true);

create policy maturity_assessment_question_notes_select
on public.maturity_assessment_question_notes for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

grant select on public.maturity_assessment_question_notes to authenticated;

grant execute on function public.upsert_maturity_assessment_question_note(uuid, uuid, text)
  to authenticated;
revoke all on function public.upsert_maturity_assessment_question_note(uuid, uuid, text)
  from public, anon;

alter function private.upsert_maturity_assessment_question_note(uuid, uuid, text)
  owner to lean_hub_private_owner;
