-- ONBOARD-SAFE-ORG-HINT-01 (#264)
--
-- During self-serve organisation founding, authenticated users whose
-- verified corporate email domain already appears on an active membership may
-- receive a generic hint to ask their administrator for an invitation.
-- This must not disclose organisation names, counts, member lists, or sites.

create or replace function private.normalised_corporate_email_domain(target_email text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  normalised text := lower(btrim(target_email));
  domain text;
begin
  if normalised is null or normalised = '' then
    return null;
  end if;

  if normalised !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return null;
  end if;

  domain := split_part(normalised, '@', 2);

  if domain = any (
    array[
      'aol.com',
      'fastmail.com',
      'gmail.com',
      'gmx.com',
      'gmx.de',
      'googlemail.com',
      'hotmail.co.uk',
      'hotmail.com',
      'icloud.com',
      'live.com',
      'mac.com',
      'mail.com',
      'me.com',
      'msn.com',
      'outlook.com',
      'proton.me',
      'protonmail.com',
      'yahoo.co.uk',
      'yahoo.com',
      'yandex.com'
    ]
  ) then
    return null;
  end if;

  return domain;
end;
$$;

create or replace function private.founding_organisation_domain_hint_state(
  actor_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_email text;
  actor_domain text;
begin
  if actor_user_id is null then
    return 'none';
  end if;

  if not private.current_can_found_organisation() then
    return 'none';
  end if;

  if exists (
    select 1
    from public.organisation_memberships membership
    where membership.user_id = actor_user_id
      and membership.status = 'active'
  ) then
    return 'none';
  end if;

  select lower(btrim(auth_user.email))
  into actor_email
  from auth.users auth_user
  where auth_user.id = actor_user_id
    and auth_user.email_confirmed_at is not null;

  actor_domain := private.normalised_corporate_email_domain(actor_email);
  if actor_domain is null then
    return 'none';
  end if;

  if exists (
    select 1
    from auth.users other_user
    join public.organisation_memberships membership
      on membership.user_id = other_user.id
     and membership.status = 'active'
    where other_user.id <> actor_user_id
      and other_user.email_confirmed_at is not null
      and private.normalised_corporate_email_domain(other_user.email) = actor_domain
  ) then
    return 'possible_existing_organisation';
  end if;

  return 'none';
end;
$$;

create or replace function public.current_founding_organisation_domain_hint()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'state',
    coalesce(
      private.founding_organisation_domain_hint_state(private.auth_uid()),
      'none'
    )
  )
$$;

revoke all on function private.normalised_corporate_email_domain(text)
  from public, anon, authenticated;
revoke all on function private.founding_organisation_domain_hint_state(uuid)
  from public, anon, authenticated;
revoke all on function public.current_founding_organisation_domain_hint()
  from public, anon, authenticated;

alter function private.normalised_corporate_email_domain(text)
  owner to postgres;
alter function private.founding_organisation_domain_hint_state(uuid)
  owner to postgres;
alter function public.current_founding_organisation_domain_hint()
  owner to postgres;

grant execute on function public.current_founding_organisation_domain_hint()
  to authenticated;
grant execute on function private.normalised_corporate_email_domain(text)
  to postgres;
grant execute on function private.founding_organisation_domain_hint_state(uuid)
  to postgres;
