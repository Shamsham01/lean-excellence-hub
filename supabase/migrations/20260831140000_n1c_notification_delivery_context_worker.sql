-- N1c: narrowly scoped delivery context resolution for the notification delivery worker.

create or replace function private.is_deliverable_email_address(candidate text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    candidate is not null
    and candidate = lower(btrim(candidate))
    and char_length(candidate) between 3 and 320
    and candidate ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and candidate not like '%@workforce.invalid'
    and right(candidate, 8) <> '.invalid'
$$;

create or replace function private.get_notification_delivery_context(
  target_organisation_id uuid,
  target_delivery_id uuid,
  target_source_domain_event_id uuid
)
returns table (
  organisation_id uuid,
  organisation_name text,
  delivery_id uuid,
  source_domain_event_id uuid,
  notification_kind text,
  recipient_membership_id uuid,
  recipient_display_name text,
  recipient_resolution_status text,
  deliverable_email text,
  event_type text,
  resource_record_id uuid,
  event_payload jsonb,
  context_title text,
  context_detail text,
  context_link_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  delivery_row private.notification_delivery_ledger%rowtype;
  event_row private.domain_event_outbox%rowtype;
  membership_row public.organisation_memberships%rowtype;
  organisation_row public.organisations%rowtype;
  notification_contact text;
  auth_email text;
  workforce_status text;
  resolved_email text;
  resolution_status text;
  resolved_title text;
  resolved_detail text;
  resolved_link_path text;
begin
  select ledger_row.*
  into delivery_row
  from private.notification_delivery_ledger ledger_row
  where ledger_row.organisation_id = target_organisation_id
    and ledger_row.id = target_delivery_id
    and ledger_row.source_domain_event_id = target_source_domain_event_id;

  if delivery_row.id is null then
    return;
  end if;

  select outbox_row.*
  into event_row
  from private.domain_event_outbox outbox_row
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_source_domain_event_id;

  if event_row.id is null then
    return;
  end if;

  select membership.*
  into membership_row
  from public.organisation_memberships membership
  where membership.organisation_id = target_organisation_id
    and membership.id = delivery_row.recipient_membership_id;

  if membership_row.id is null then
    return;
  end if;

  select organisation.*
  into organisation_row
  from public.organisations organisation
  where organisation.id = target_organisation_id;

  if organisation_row.id is null then
    return;
  end if;

  select contact_row.contact_address
  into notification_contact
  from public.membership_notification_contacts contact_row
  where contact_row.organisation_id = target_organisation_id
    and contact_row.membership_id = delivery_row.recipient_membership_id
    and contact_row.channel_type = 'email'
    and contact_row.status = 'active'
  limit 1;

  select lower(btrim(auth_user.email))
  into auth_email
  from auth.users auth_user
  where auth_user.id = membership_row.user_id;

  select workforce_account.status
  into workforce_status
  from private.workforce_accounts workforce_account
  where workforce_account.user_id = membership_row.user_id
  limit 1;

  if membership_row.status <> 'active' then
    resolution_status := 'inactive_membership';
    resolved_email := null;
  elsif workforce_status = 'disabled' then
    resolution_status := 'disabled_workforce_account';
    resolved_email := null;
  elsif notification_contact is not null
    and private.is_deliverable_email_address(notification_contact) then
    resolution_status := 'deliverable';
    resolved_email := notification_contact;
  elsif notification_contact is not null then
    resolution_status := 'invalid_email';
    resolved_email := null;
  elsif auth_email is not null
    and private.is_deliverable_email_address(auth_email) then
    resolution_status := 'deliverable';
    resolved_email := auth_email;
  elsif auth_email is not null
    and (
      auth_email like '%@workforce.invalid'
      or right(auth_email, 8) = '.invalid'
    ) then
    resolution_status := 'synthetic_auth_email';
    resolved_email := null;
  elsif auth_email is not null then
    resolution_status := 'invalid_email';
    resolved_email := null;
  else
    resolution_status := 'no_contact';
    resolved_email := null;
  end if;

  resolved_title := null;
  resolved_detail := null;
  resolved_link_path := null;

  if delivery_row.notification_kind = 'workforce.job_function_assigned' then
    select
      coalesce(assignment_row.job_function_name_snapshot, 'Job function'),
      case
        when assignment_row.is_primary then 'Primary assignment'
        else 'Assignment update'
      end,
      '/platform/people'
    into resolved_title, resolved_detail, resolved_link_path
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/people');
  elsif delivery_row.notification_kind = 'workforce.training_completed' then
    select
      coalesce(course_row.name, 'Training course'),
      'Training completion recorded',
      case
        when course_row.id is not null
          then '/platform/training/courses/' || course_row.id::text
        else '/platform/training/matrix'
      end
    into resolved_title, resolved_detail, resolved_link_path
    from public.training_completions completion_row
    left join public.training_courses course_row
      on course_row.organisation_id = completion_row.organisation_id
     and course_row.id = completion_row.course_id
    where completion_row.organisation_id = target_organisation_id
      and completion_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/training/matrix');
  elsif delivery_row.notification_kind = 'workforce.skill_proficiency_validated' then
    select
      coalesce(skill_row.name, 'Skill'),
      'Skill proficiency validated',
      case
        when skill_row.id is not null
          then '/platform/skills/' || skill_row.id::text
        else '/platform/skills/matrix'
      end
    into resolved_title, resolved_detail, resolved_link_path
    from public.membership_skill_assessments assessment_row
    left join public.skills skill_row
      on skill_row.organisation_id = assessment_row.organisation_id
     and skill_row.id = assessment_row.skill_id
    where assessment_row.organisation_id = target_organisation_id
      and assessment_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/skills/matrix');
  elsif delivery_row.notification_kind = 'recognition.awarded' then
    select
      coalesce(award_row.title, 'Recognition award'),
      left(award_row.message, 500),
      '/platform/recognition'
    into resolved_title, resolved_detail, resolved_link_path
    from public.recognition_awards award_row
    where award_row.organisation_id = target_organisation_id
      and award_row.id = event_row.resource_record_id
      and award_row.status = 'active'
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/recognition');
  end if;

  return query
  select
    target_organisation_id,
    organisation_row.name,
    delivery_row.id,
    delivery_row.source_domain_event_id,
    delivery_row.notification_kind,
    delivery_row.recipient_membership_id,
    coalesce(nullif(btrim(membership_row.display_name), ''), 'Team member'),
    resolution_status,
    resolved_email,
    event_row.event_type,
    event_row.resource_record_id,
    event_row.payload,
    resolved_title,
    resolved_detail,
    resolved_link_path;
end;
$$;

create or replace function public.get_notification_delivery_context_for_worker(
  target_organisation_id uuid,
  target_delivery_id uuid,
  target_source_domain_event_id uuid
)
returns table (
  organisation_id uuid,
  organisation_name text,
  delivery_id uuid,
  source_domain_event_id uuid,
  notification_kind text,
  recipient_membership_id uuid,
  recipient_display_name text,
  recipient_resolution_status text,
  deliverable_email text,
  event_type text,
  resource_record_id uuid,
  event_payload jsonb,
  context_title text,
  context_detail text,
  context_link_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_notification_delivery_context(
    target_organisation_id,
    target_delivery_id,
    target_source_domain_event_id
  )
$$;

alter function private.is_deliverable_email_address(text)
  owner to lean_hub_private_owner;
alter function private.get_notification_delivery_context(uuid, uuid, uuid)
  owner to postgres;

revoke all on function private.is_deliverable_email_address(text)
  from public, anon, authenticated;
revoke all on function private.get_notification_delivery_context(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.is_deliverable_email_address(text)
  to postgres;
grant execute on function private.get_notification_delivery_context(uuid, uuid, uuid)
  to service_role;

revoke all on function public.get_notification_delivery_context_for_worker(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_notification_delivery_context_for_worker(uuid, uuid, uuid)
  to service_role;

-- Immutable provider envelope: frozen at first send preparation so retries reuse
-- the exact same Resend payload even when live membership/contact/context changes.

create table private.notification_delivery_provider_envelopes (
  organisation_id uuid not null,
  delivery_id uuid not null,
  delivery_key text not null,
  sender_from text not null,
  recipient_email text not null,
  subject text not null,
  html_body text not null,
  text_body text not null,
  payload_hash text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint notification_delivery_provider_envelopes_pkey
    primary key (organisation_id, delivery_id),
  constraint notification_delivery_provider_envelopes_delivery_fkey
    foreign key (organisation_id, delivery_id)
    references private.notification_delivery_ledger(organisation_id, id)
    on delete restrict,
  constraint notification_delivery_provider_envelopes_delivery_key_check
    check (
      delivery_key = btrim(delivery_key)
      and char_length(delivery_key) between 1 and 200
    ),
  constraint notification_delivery_provider_envelopes_sender_check
    check (
      sender_from = btrim(sender_from)
      and char_length(sender_from) between 3 and 320
    ),
  constraint notification_delivery_provider_envelopes_recipient_check
    check (
      recipient_email = lower(btrim(recipient_email))
      and char_length(recipient_email) between 3 and 320
    ),
  constraint notification_delivery_provider_envelopes_subject_check
    check (
      subject = btrim(subject)
      and char_length(subject) between 1 and 500
    ),
  constraint notification_delivery_provider_envelopes_payload_hash_check
    check (
      payload_hash = lower(btrim(payload_hash))
      and char_length(payload_hash) = 64
    )
);

alter table private.notification_delivery_provider_envelopes enable row level security;
alter table private.notification_delivery_provider_envelopes force row level security;

grant select, insert on private.notification_delivery_provider_envelopes
  to lean_hub_private_owner;

create policy private_owner_all_notification_delivery_provider_envelopes
on private.notification_delivery_provider_envelopes
for all
to lean_hub_private_owner
using (true)
with check (true);

create or replace function private.get_notification_delivery_provider_envelope(
  target_organisation_id uuid,
  target_delivery_id uuid
)
returns table (
  organisation_id uuid,
  delivery_id uuid,
  delivery_key text,
  sender_from text,
  recipient_email text,
  subject text,
  html_body text,
  text_body text,
  payload_hash text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    envelope_row.organisation_id,
    envelope_row.delivery_id,
    envelope_row.delivery_key,
    envelope_row.sender_from,
    envelope_row.recipient_email,
    envelope_row.subject,
    envelope_row.html_body,
    envelope_row.text_body,
    envelope_row.payload_hash
  from private.notification_delivery_provider_envelopes envelope_row
  where envelope_row.organisation_id = target_organisation_id
    and envelope_row.delivery_id = target_delivery_id
$$;

create or replace function private.store_notification_delivery_provider_envelope(
  target_organisation_id uuid,
  target_delivery_id uuid,
  expected_delivery_key text,
  target_sender_from text,
  target_recipient_email text,
  target_subject text,
  target_html_body text,
  target_text_body text,
  target_payload_hash text
)
returns table (
  organisation_id uuid,
  delivery_id uuid,
  delivery_key text,
  sender_from text,
  recipient_email text,
  subject text,
  html_body text,
  text_body text,
  payload_hash text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  matched_ledger_row private.notification_delivery_ledger%rowtype;
  existing_row private.notification_delivery_provider_envelopes%rowtype;
begin
  select delivery_ledger.*
  into matched_ledger_row
  from private.notification_delivery_ledger delivery_ledger
  where delivery_ledger.organisation_id = target_organisation_id
    and delivery_ledger.id = target_delivery_id;

  if matched_ledger_row.id is null then
    raise exception 'delivery not found'
      using errcode = 'P0002';
  end if;

  if matched_ledger_row.delivery_key is distinct from expected_delivery_key then
    raise exception 'delivery_key does not match ledger row'
      using errcode = '22023';
  end if;

  select envelope_row.*
  into existing_row
  from private.notification_delivery_provider_envelopes envelope_row
  where envelope_row.organisation_id = target_organisation_id
    and envelope_row.delivery_id = target_delivery_id;

  if existing_row.delivery_id is not null then
    if existing_row.payload_hash is distinct from lower(btrim(target_payload_hash)) then
      raise exception 'provider envelope already exists with different payload'
        using errcode = '23505';
    end if;

    return query
    select
      existing_row.organisation_id,
      existing_row.delivery_id,
      existing_row.delivery_key,
      existing_row.sender_from,
      existing_row.recipient_email,
      existing_row.subject,
      existing_row.html_body,
      existing_row.text_body,
      existing_row.payload_hash;
    return;
  end if;

  insert into private.notification_delivery_provider_envelopes (
    organisation_id,
    delivery_id,
    delivery_key,
    sender_from,
    recipient_email,
    subject,
    html_body,
    text_body,
    payload_hash
  )
  values (
    target_organisation_id,
    target_delivery_id,
    expected_delivery_key,
    btrim(target_sender_from),
    lower(btrim(target_recipient_email)),
    btrim(target_subject),
    target_html_body,
    target_text_body,
    lower(btrim(target_payload_hash))
  );

  return query
  select
    envelope_row.organisation_id,
    envelope_row.delivery_id,
    envelope_row.delivery_key,
    envelope_row.sender_from,
    envelope_row.recipient_email,
    envelope_row.subject,
    envelope_row.html_body,
    envelope_row.text_body,
    envelope_row.payload_hash
  from private.notification_delivery_provider_envelopes envelope_row
  where envelope_row.organisation_id = target_organisation_id
    and envelope_row.delivery_id = target_delivery_id;
end;
$$;

create or replace function public.get_notification_delivery_provider_envelope_for_worker(
  target_organisation_id uuid,
  target_delivery_id uuid
)
returns table (
  organisation_id uuid,
  delivery_id uuid,
  delivery_key text,
  sender_from text,
  recipient_email text,
  subject text,
  html_body text,
  text_body text,
  payload_hash text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_notification_delivery_provider_envelope(
    target_organisation_id,
    target_delivery_id
  )
$$;

create or replace function public.store_notification_delivery_provider_envelope_for_worker(
  target_organisation_id uuid,
  target_delivery_id uuid,
  expected_delivery_key text,
  target_sender_from text,
  target_recipient_email text,
  target_subject text,
  target_html_body text,
  target_text_body text,
  target_payload_hash text
)
returns table (
  organisation_id uuid,
  delivery_id uuid,
  delivery_key text,
  sender_from text,
  recipient_email text,
  subject text,
  html_body text,
  text_body text,
  payload_hash text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.store_notification_delivery_provider_envelope(
    target_organisation_id,
    target_delivery_id,
    expected_delivery_key,
    target_sender_from,
    target_recipient_email,
    target_subject,
    target_html_body,
    target_text_body,
    target_payload_hash
  )
$$;

alter function private.get_notification_delivery_provider_envelope(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.store_notification_delivery_provider_envelope(
  uuid, uuid, text, text, text, text, text, text, text
) owner to lean_hub_private_owner;

revoke all on function private.get_notification_delivery_provider_envelope(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.store_notification_delivery_provider_envelope(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function private.get_notification_delivery_provider_envelope(uuid, uuid)
  to service_role;
grant execute on function private.store_notification_delivery_provider_envelope(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;

revoke all on function public.get_notification_delivery_provider_envelope_for_worker(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.store_notification_delivery_provider_envelope_for_worker(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.get_notification_delivery_provider_envelope_for_worker(uuid, uuid)
  to service_role;
grant execute on function public.store_notification_delivery_provider_envelope_for_worker(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;
