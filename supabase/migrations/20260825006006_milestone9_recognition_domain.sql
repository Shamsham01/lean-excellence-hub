-- Milestone 9: recognition domain.

create table public.recognition_types (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active',
  display_metadata jsonb,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint recognition_types_organisation_id_id_key unique (organisation_id, id),
  constraint recognition_types_org_code_key unique (organisation_id, code),
  constraint recognition_types_organisation_fkey foreign key (organisation_id) references public.organisations(id) on delete restrict,
  constraint recognition_types_creator_fkey foreign key (organisation_id, created_by_membership_id) references public.organisation_memberships(organisation_id, id) on delete restrict,
  constraint recognition_types_name_check check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint recognition_types_code_check check (code = btrim(code) and char_length(code) between 1 and 80),
  constraint recognition_types_status_check check (status in ('active', 'deactivated'))
);

create table public.recognition_awards (
  id uuid primary key,
  organisation_id uuid not null,
  recognition_type_id uuid not null,
  recognition_type_name_snapshot text not null,
  title text not null,
  message text not null,
  awarded_by_membership_id uuid not null,
  awarded_at timestamptz not null default statement_timestamp(),
  organisational_unit_id uuid not null,
  source_resource_id uuid,
  visibility text not null default 'unit',
  status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  constraint recognition_awards_organisation_id_id_key unique (organisation_id, id),
  constraint recognition_awards_resource_fkey foreign key (organisation_id, id) references public.resource_records(organisation_id, id) on delete restrict,
  constraint recognition_awards_type_fkey foreign key (organisation_id, recognition_type_id) references public.recognition_types(organisation_id, id) on delete restrict,
  constraint recognition_awards_awarder_fkey foreign key (organisation_id, awarded_by_membership_id) references public.organisation_memberships(organisation_id, id) on delete restrict,
  constraint recognition_awards_unit_fkey foreign key (organisation_id, organisational_unit_id) references public.organisation_units(organisation_id, id) on delete restrict,
  constraint recognition_awards_source_fkey foreign key (organisation_id, source_resource_id) references public.resource_records(organisation_id, id) on delete restrict,
  constraint recognition_awards_title_check check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint recognition_awards_message_check check (message = btrim(message) and char_length(message) between 1 and 4000),
  constraint recognition_awards_visibility_check check (visibility in ('recipient_only', 'unit', 'organisation')),
  constraint recognition_awards_status_check check (status in ('active', 'revoked'))
);

create table public.recognition_recipients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  recognition_award_id uuid not null,
  membership_id uuid not null,
  contribution_summary text,
  created_at timestamptz not null default statement_timestamp(),
  constraint recognition_recipients_organisation_id_id_key unique (organisation_id, id),
  constraint recognition_recipients_award_member_key unique (organisation_id, recognition_award_id, membership_id),
  constraint recognition_recipients_award_fkey foreign key (organisation_id, recognition_award_id) references public.recognition_awards(organisation_id, id) on delete restrict,
  constraint recognition_recipients_membership_fkey foreign key (organisation_id, membership_id) references public.organisation_memberships(organisation_id, id) on delete restrict
);

create table public.recognition_revocations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  recognition_award_id uuid not null,
  revoked_at timestamptz not null default statement_timestamp(),
  revoked_by_membership_id uuid not null,
  reason text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint recognition_revocations_organisation_id_id_key unique (organisation_id, id),
  constraint recognition_revocations_award_key unique (organisation_id, recognition_award_id),
  constraint recognition_revocations_award_fkey foreign key (organisation_id, recognition_award_id) references public.recognition_awards(organisation_id, id) on delete restrict,
  constraint recognition_revocations_revoker_fkey foreign key (organisation_id, revoked_by_membership_id) references public.organisation_memberships(organisation_id, id) on delete restrict,
  constraint recognition_revocations_reason_check check (reason = btrim(reason) and char_length(reason) between 1 and 2000)
);

create or replace function private.prevent_recognition_award_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.recognition_type_id is distinct from old.recognition_type_id
    or new.recognition_type_name_snapshot is distinct from old.recognition_type_name_snapshot
    or new.awarded_by_membership_id is distinct from old.awarded_by_membership_id
    or new.awarded_at is distinct from old.awarded_at
    or new.organisational_unit_id is distinct from old.organisational_unit_id
    or new.source_resource_id is distinct from old.source_resource_id
    or new.visibility is distinct from old.visibility then
    raise exception 'recognition award is immutable' using errcode = '55000';
  end if;
  return new;
end; $$;

create trigger recognition_awards_prevent_mutation
before update on public.recognition_awards
for each row execute function private.prevent_recognition_award_mutation();

create trigger recognition_recipients_prevent_update
before update on public.recognition_recipients
for each row execute function private.prevent_update_or_delete();
create trigger recognition_recipients_prevent_delete
before delete on public.recognition_recipients
for each row execute function private.prevent_update_or_delete();
create trigger recognition_revocations_prevent_update
before update on public.recognition_revocations
for each row execute function private.prevent_update_or_delete();
create trigger recognition_revocations_prevent_delete
before delete on public.recognition_revocations
for each row execute function private.prevent_update_or_delete();

alter table public.recognition_types enable row level security;
alter table public.recognition_types force row level security;
alter table public.recognition_awards enable row level security;
alter table public.recognition_awards force row level security;
alter table public.recognition_recipients enable row level security;
alter table public.recognition_recipients force row level security;
alter table public.recognition_revocations enable row level security;
alter table public.recognition_revocations force row level security;

revoke all on public.recognition_types from public, anon, authenticated, service_role;
revoke all on public.recognition_awards from public, anon, authenticated, service_role;
revoke all on public.recognition_recipients from public, anon, authenticated, service_role;
revoke all on public.recognition_revocations from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.recognition_types to lean_hub_private_owner;
grant select, insert, update, delete on public.recognition_awards to lean_hub_private_owner;
grant select, insert, update, delete on public.recognition_recipients to lean_hub_private_owner;
grant select, insert, update, delete on public.recognition_revocations to lean_hub_private_owner;

create policy private_owner_all_recognition_types on public.recognition_types for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_recognition_awards on public.recognition_awards for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_recognition_recipients on public.recognition_recipients for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_recognition_revocations on public.recognition_revocations for all to lean_hub_private_owner using (true) with check (true);

alter function private.prevent_recognition_award_mutation() owner to lean_hub_private_owner;
