create table public.templates (
  id uuid primary key,
  organisation_id uuid not null,
  experience_type text not null default 'audit_form',
  display_name text not null,
  description text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint templates_organisation_id_id_key unique (organisation_id, id),
  constraint templates_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint templates_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint templates_display_name_check
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 160)
);

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  template_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  created_by_membership_id uuid not null,
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint template_versions_organisation_id_id_key unique (organisation_id, id),
  constraint template_versions_template_version_key
    unique (organisation_id, template_id, version_number),
  constraint template_versions_template_fkey
    foreign key (organisation_id, template_id)
    references public.templates(organisation_id, id)
    on delete restrict,
  constraint template_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint template_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.template_sections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  template_version_id uuid not null,
  title text not null,
  position integer not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint template_sections_organisation_id_id_key unique (organisation_id, id),
  constraint template_sections_version_position_key
    unique (organisation_id, template_version_id, position),
  constraint template_sections_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint template_sections_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160)
);

create table public.template_questions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  template_version_id uuid not null,
  section_id uuid not null,
  question_type text not null,
  prompt text not null,
  position integer not null,
  is_required boolean not null default true,
  allows_not_applicable boolean not null default false,
  help_text text,
  options jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint template_questions_organisation_id_id_key unique (organisation_id, id),
  constraint template_questions_section_position_key
    unique (organisation_id, section_id, position),
  constraint template_questions_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint template_questions_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint template_questions_type_check
    check (
      question_type in (
        'yes_no',
        'pass_fail',
        'short_text',
        'long_text',
        'number',
        'percentage',
        'score',
        'date',
        'single_select',
        'multi_select',
        'person',
        'people',
        'image_evidence',
        'document_evidence',
        'risk_rating'
      )
    ),
  constraint template_questions_prompt_check
    check (prompt = btrim(prompt) and char_length(prompt) between 1 and 500)
);

create table public.template_submissions (
  id uuid primary key,
  organisation_id uuid not null,
  template_version_id uuid not null,
  status text not null default 'draft',
  created_by_membership_id uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint template_submissions_organisation_id_id_key unique (organisation_id, id),
  constraint template_submissions_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint template_submissions_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint template_submissions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint template_submissions_status_check
    check (status in ('draft', 'completed'))
);

create table public.template_answers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  submission_id uuid not null,
  question_id uuid not null,
  is_not_applicable boolean not null default false,
  text_value text,
  number_value numeric,
  date_value date,
  json_value jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint template_answers_organisation_id_id_key unique (organisation_id, id),
  constraint template_answers_submission_question_key
    unique (organisation_id, submission_id, question_id),
  constraint template_answers_submission_fkey
    foreign key (organisation_id, submission_id)
    references public.template_submissions(organisation_id, id)
    on delete restrict,
  constraint template_questions_answer_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict
);

create table public.template_answer_people (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  submission_id uuid not null,
  question_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint template_answer_people_submission_question_member_key
    unique (organisation_id, submission_id, question_id, membership_id),
  constraint template_answer_people_submission_fkey
    foreign key (organisation_id, submission_id)
    references public.template_submissions(organisation_id, id)
    on delete restrict,
  constraint template_answer_people_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint template_answer_people_member_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create or replace function private.guard_published_template_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_status text;
  target_version_id uuid;
begin
  if tg_table_name = 'template_sections' then
    target_version_id := coalesce(new.template_version_id, old.template_version_id);
  elsif tg_table_name = 'template_questions' then
    target_version_id := coalesce(
      new.template_version_id,
      old.template_version_id,
      (
        select section_row.template_version_id
        from public.template_sections section_row
        where section_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
          and section_row.id = coalesce(new.section_id, old.section_id)
      )
    );
  else
    return coalesce(new, old);
  end if;

  select template_version.status
  into version_status
  from public.template_versions template_version
  where template_version.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and template_version.id = target_version_id;

  if version_status = 'published' then
    raise exception 'published template version is immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.guard_completed_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  submission_status text;
begin
  select submission_row.status
  into submission_status
  from public.template_submissions submission_row
  where submission_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and submission_row.id = coalesce(new.submission_id, old.id);

  if submission_status = 'completed' then
    raise exception 'completed submission is immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger template_sections_guard_published
before insert or update or delete on public.template_sections
for each row execute function private.guard_published_template_version();

create trigger template_questions_guard_published
before insert or update or delete on public.template_questions
for each row execute function private.guard_published_template_version();

create trigger template_answers_guard_completed
before insert or update or delete on public.template_answers
for each row execute function private.guard_completed_submission();

create trigger template_answer_people_guard_completed
before insert or update or delete on public.template_answer_people
for each row execute function private.guard_completed_submission();

alter table public.templates enable row level security;
alter table public.templates force row level security;
alter table public.template_versions enable row level security;
alter table public.template_versions force row level security;
alter table public.template_sections enable row level security;
alter table public.template_sections force row level security;
alter table public.template_questions enable row level security;
alter table public.template_questions force row level security;
alter table public.template_submissions enable row level security;
alter table public.template_submissions force row level security;
alter table public.template_answers enable row level security;
alter table public.template_answers force row level security;
alter table public.template_answer_people enable row level security;
alter table public.template_answer_people force row level security;

create or replace function private.can_read_template_submission(
  target_organisation_id uuid,
  target_submission_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.template_submissions submission_row
    where submission_row.organisation_id = target_organisation_id
      and submission_row.id = target_submission_id
      and private.has_scoped_permission(
        target_organisation_id,
        'submissions.read',
        submission_row.created_by_membership_id,
        null
      )
  )
$$;

create or replace function private.create_template_draft(
  target_display_name text,
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
  new_template_id uuid;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'templates.manage', null, null) then
    raise exception 'template creation is not authorised'
      using errcode = '42501';
  end if;

  new_template_id := private.register_resource_record(
    org_id,
    'template',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.templates (
    id,
    organisation_id,
    display_name,
    description,
    created_by_membership_id
  )
  values (
    new_template_id,
    org_id,
    target_display_name,
    target_description,
    actor_membership_id
  );

  insert into public.template_versions (
    organisation_id,
    template_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    new_template_id,
    1,
    'draft',
    actor_membership_id
  )
  returning id into new_version_id;

  return new_template_id;
end;
$$;

create or replace function private.publish_template_version(
  target_template_version_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  target_template_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'templates.manage', null, null) then
    raise exception 'template publication is not authorised'
      using errcode = '42501';
  end if;

  select template_version.template_id
  into target_template_id
  from public.template_versions template_version
  where template_version.organisation_id = org_id
    and template_version.id = target_template_version_id
    and template_version.status = 'draft'
  for update;

  if not found then
    raise exception 'template version is not publishable'
      using errcode = '55000';
  end if;

  update public.template_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_template_version_id;

  perform private.append_business_audit(
    org_id,
    'template.published',
    target_template_id,
    'succeeded',
    jsonb_build_object('template_version_id', target_template_version_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_template_id,
    'TemplatePublished',
    target_template_version_id::text,
    jsonb_build_object('template_version_id', target_template_version_id)
  );

  return true;
end;
$$;

create or replace function private.create_template_submission(
  target_template_version_id uuid
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
  new_submission_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'submissions.create', null, null) then
    raise exception 'submission creation is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.template_versions template_version
    where template_version.organisation_id = org_id
      and template_version.id = target_template_version_id
      and template_version.status = 'published'
  ) then
    raise exception 'template version is not published'
      using errcode = '55000';
  end if;

  new_submission_id := private.register_resource_record(
    org_id,
    'template_submission',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.template_submissions (
    id,
    organisation_id,
    template_version_id,
    created_by_membership_id
  )
  values (
    new_submission_id,
    org_id,
    target_template_version_id,
    actor_membership_id
  );

  return new_submission_id;
end;
$$;

create or replace function private.complete_template_submission(
  target_submission_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'submissions.create', null, null) then
    raise exception 'submission completion is not authorised'
      using errcode = '42501';
  end if;

  update public.template_submissions submission_row
  set status = 'completed',
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where submission_row.organisation_id = org_id
    and submission_row.id = target_submission_id
    and submission_row.status = 'draft';

  if not found then
    raise exception 'submission is not completable'
      using errcode = '55000';
  end if;

  perform private.append_business_audit(
    org_id,
    'submission.completed',
    target_submission_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_submission_id,
    'SubmissionCompleted',
    target_submission_id::text,
    jsonb_build_object('submission_id', target_submission_id)
  );

  return true;
end;
$$;

create or replace function public.create_template_draft(
  target_display_name text,
  target_description text default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.create_template_draft(target_display_name, target_description) $$;

create or replace function public.publish_template_version(target_template_version_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.publish_template_version(target_template_version_id) $$;

create or replace function public.create_template_submission(target_template_version_id uuid)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.create_template_submission(target_template_version_id) $$;

create or replace function public.complete_template_submission(target_submission_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.complete_template_submission(target_submission_id) $$;

create policy templates_select
on public.templates for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'templates.read', null, null)
);

create policy template_versions_select
on public.template_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'templates.read', null, null)
);

create policy template_sections_select
on public.template_sections for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'templates.read', null, null)
);

create policy template_questions_select
on public.template_questions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'templates.read', null, null)
);

create policy template_submissions_select
on public.template_submissions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_template_submission(organisation_id, id)
);

grant execute on function public.create_template_draft(text, text) to authenticated;
grant execute on function public.publish_template_version(uuid) to authenticated;
grant execute on function public.create_template_submission(uuid) to authenticated;
grant execute on function public.complete_template_submission(uuid) to authenticated;

grant select on public.templates to authenticated;
grant select on public.template_versions to authenticated;
grant select on public.template_sections to authenticated;
grant select on public.template_questions to authenticated;
grant select on public.template_submissions to authenticated;
grant select on public.template_answers to authenticated;
grant select on public.template_answer_people to authenticated;
