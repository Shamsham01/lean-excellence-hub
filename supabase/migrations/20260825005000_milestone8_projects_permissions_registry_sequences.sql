-- Milestone 8: project permissions, registry, organisation document sequences.

insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('projects.read', 'Read CI improvement projects within authorised scope.', false),
  ('projects.manage', 'Create and manage CI improvement projects within authorised scope.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array['projects.read', 'projects.manage']::text[]
);

alter table public.resource_records
  drop constraint resource_records_type_check;

alter table public.resource_records
  add constraint resource_records_type_check
  check (
    resource_type in (
      'action',
      'template',
      'template_submission',
      'attachment',
      'comment',
      'maturity_model',
      'maturity_assessment',
      'schedule_definition',
      'five_s_standard',
      'five_s_audit',
      'gemba_definition',
      'gemba_walk',
      'training_course',
      'training_session',
      'training_completion',
      'skill',
      'skill_assessment',
      'ci_project'
    )
  );

create table public.organisation_document_sequences (
  organisation_id uuid not null,
  sequence_key text not null,
  sequence_year integer not null,
  last_value integer not null default 0,
  constraint organisation_document_sequences_pkey
    primary key (organisation_id, sequence_key, sequence_year),
  constraint organisation_document_sequences_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint organisation_document_sequences_key_check
    check (sequence_key = btrim(sequence_key) and char_length(sequence_key) between 1 and 80),
  constraint organisation_document_sequences_year_check
    check (sequence_year between 2000 and 2100),
  constraint organisation_document_sequences_last_value_check
    check (last_value >= 0)
);

alter table public.organisation_document_sequences enable row level security;
alter table public.organisation_document_sequences force row level security;
revoke all on public.organisation_document_sequences from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.organisation_document_sequences to lean_hub_private_owner;

create policy private_owner_all_organisation_document_sequences
on public.organisation_document_sequences for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.allocate_organisation_document_number(
  target_organisation_id uuid,
  target_sequence_key text,
  target_prefix text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_year integer := extract(year from statement_timestamp())::integer;
  next_value integer;
  normalized_prefix text := upper(btrim(target_prefix));
begin
  if target_organisation_id is null
    or target_sequence_key is null
    or btrim(target_sequence_key) = ''
    or normalized_prefix is null
    or char_length(normalized_prefix) = 0 then
    raise exception 'invalid document number allocation request'
      using errcode = '22023';
  end if;

  insert into public.organisation_document_sequences (
    organisation_id,
    sequence_key,
    sequence_year,
    last_value
  )
  values (
    target_organisation_id,
    btrim(target_sequence_key),
    current_year,
    1
  )
  on conflict (organisation_id, sequence_key, sequence_year)
  do update
    set last_value = public.organisation_document_sequences.last_value + 1
  returning last_value into next_value;

  return format('%s-%s-%s', normalized_prefix, current_year, lpad(next_value::text, 4, '0'));
end;
$$;

create or replace function private.register_resource_record(
  target_organisation_id uuid,
  target_resource_type text,
  target_resource_id uuid default gen_random_uuid(),
  target_created_by_membership_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_resource_type not in (
    'action',
    'template',
    'template_submission',
    'attachment',
    'comment',
    'maturity_model',
    'maturity_assessment',
    'schedule_definition',
    'five_s_standard',
    'five_s_audit',
    'gemba_definition',
    'gemba_walk',
    'training_course',
    'training_session',
    'training_completion',
    'skill',
    'skill_assessment',
    'ci_project'
  ) then
    raise exception 'invalid resource type'
      using errcode = '22023';
  end if;

  insert into public.resource_records (
    id,
    organisation_id,
    resource_type,
    created_by_membership_id
  )
  values (
    target_resource_id,
    target_organisation_id,
    target_resource_type,
    target_created_by_membership_id
  );

  return target_resource_id;
end;
$$;

revoke all on function private.allocate_organisation_document_number(uuid, text, text) from public;
grant execute on function private.allocate_organisation_document_number(uuid, text, text) to lean_hub_private_owner;
