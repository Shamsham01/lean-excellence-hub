-- Persist Checkout plan/quantity so fake completion can reconstruct the
-- session when Next.js isolates the in-memory billing provider.

alter table public.organisation_billing_accounts
  add column if not exists open_checkout_context jsonb;

alter table public.organisation_billing_accounts
  drop constraint if exists organisation_billing_accounts_open_checkout_context_check;

alter table public.organisation_billing_accounts
  add constraint organisation_billing_accounts_open_checkout_context_check
    check (
      open_checkout_context is null
      or (
        jsonb_typeof(open_checkout_context) = 'object'
        and coalesce(open_checkout_context ->> 'planCode', '') in (
          'essentials',
          'professional',
          'founder'
        )
        and coalesce(open_checkout_context ->> 'interval', '') in (
          'monthly',
          'annual'
        )
        and (open_checkout_context ->> 'siteQuantity') ~ '^[0-9]+$'
        and (open_checkout_context ->> 'siteQuantity')::integer >= 1
      )
    );

drop function if exists public.set_organisation_open_checkout_session(uuid, text, timestamptz);
drop function if exists private.set_organisation_open_checkout_session(uuid, text, timestamptz);

create function private.set_organisation_open_checkout_session(
  target_organisation_id uuid,
  target_session_id text,
  target_expires_at timestamptz,
  target_checkout_context jsonb default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.organisation_billing_accounts account
  set open_checkout_session_id = nullif(btrim(target_session_id), ''),
      open_checkout_expires_at = case
        when nullif(btrim(target_session_id), '') is null then null
        else target_expires_at
      end,
      open_checkout_context = case
        when nullif(btrim(target_session_id), '') is null then null
        else target_checkout_context
      end
  where account.organisation_id = target_organisation_id;

  return found;
end;
$$;

create function public.set_organisation_open_checkout_session(
  target_organisation_id uuid,
  target_session_id text,
  target_expires_at timestamptz,
  target_checkout_context jsonb default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_organisation_open_checkout_session(
    target_organisation_id,
    target_session_id,
    target_expires_at,
    target_checkout_context
  )
$$;

create or replace function public.lookup_open_checkout_session(
  target_session_id text
)
returns table (
  organisation_id uuid,
  provider_customer_id text,
  plan_code text,
  billing_interval text,
  site_quantity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.organisation_id,
    account.provider_customer_id,
    account.open_checkout_context ->> 'planCode',
    account.open_checkout_context ->> 'interval',
    (account.open_checkout_context ->> 'siteQuantity')::integer
  from public.organisation_billing_accounts account
  where account.open_checkout_session_id = nullif(btrim(target_session_id), '')
    and account.open_checkout_context is not null
    and (
      account.open_checkout_expires_at is null
      or account.open_checkout_expires_at > statement_timestamp()
    )
$$;

revoke all on function private.set_organisation_open_checkout_session(
  uuid, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.set_organisation_open_checkout_session(
  uuid, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.lookup_open_checkout_session(text)
  from public, anon, authenticated, service_role;

alter function private.set_organisation_open_checkout_session(
  uuid, text, timestamptz, jsonb
) owner to lean_hub_private_owner;

grant execute on function public.set_organisation_open_checkout_session(
  uuid, text, timestamptz, jsonb
) to service_role;
grant execute on function public.lookup_open_checkout_session(text)
  to service_role;
