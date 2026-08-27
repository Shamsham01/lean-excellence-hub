-- Milestone 12: AI permissions and organisation settings.

insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('ai.use', 'Use Lean AI capabilities within authorised scope.', false),
  ('ai.view_history', 'View Lean AI session history created by others within authorised scope.', false),
  ('ai.manage_settings', 'Manage organisation Lean AI settings and view usage summaries.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'ai.use',
    'ai.view_history',
    'ai.manage_settings'
  ]::text[]
);

create table public.organisation_ai_settings (
  organisation_id uuid primary key
    references public.organisations(id) on delete restrict,
  ai_enabled boolean not null default false,
  monthly_token_ceiling integer,
  updated_by_membership_id uuid,
  updated_at timestamptz not null default statement_timestamp(),
  constraint organisation_ai_settings_monthly_token_ceiling_check
    check (monthly_token_ceiling is null or monthly_token_ceiling > 0)
);

alter table public.organisation_ai_settings enable row level security;
alter table public.organisation_ai_settings force row level security;

revoke all on public.organisation_ai_settings from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.organisation_ai_settings to lean_hub_private_owner;

create policy private_owner_all_organisation_ai_settings
on public.organisation_ai_settings for all to lean_hub_private_owner
using (true) with check (true);

grant select on public.organisation_ai_settings to authenticated;

create policy organisation_ai_settings_select
on public.organisation_ai_settings for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'ai.manage_settings', null, null)
);

insert into public.organisation_ai_settings (organisation_id, ai_enabled)
select organisation_table.id, false
from public.organisations organisation_table
on conflict (organisation_id) do nothing;
