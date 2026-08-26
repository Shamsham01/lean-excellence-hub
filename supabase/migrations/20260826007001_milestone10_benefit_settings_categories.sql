-- Milestone 10: benefit reporting settings and organisation categories (no automatic seed).

create table public.benefit_reporting_settings (
  organisation_id uuid primary key,
  fiscal_year_start_month smallint not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  created_by_membership_id uuid,
  updated_by_membership_id uuid,
  constraint benefit_reporting_settings_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint benefit_reporting_settings_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_reporting_settings_updater_fkey
    foreign key (organisation_id, updated_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_reporting_settings_month_check
    check (fiscal_year_start_month between 1 and 12)
);

create table public.benefit_categories (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  code text not null,
  name text not null,
  description text,
  status text not null default 'active',
  display_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint benefit_categories_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_categories_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint benefit_categories_code_org_key unique (organisation_id, code),
  constraint benefit_categories_code_check
    check (code = btrim(code) and char_length(code) between 1 and 40),
  constraint benefit_categories_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint benefit_categories_status_check
    check (status in ('active', 'archived'))
);

create trigger benefit_reporting_settings_touch_updated_at
before update on public.benefit_reporting_settings
for each row execute function private.touch_updated_at();

create trigger benefit_categories_touch_updated_at
before update on public.benefit_categories
for each row execute function private.touch_updated_at();

create trigger benefit_categories_prevent_org_change
before update on public.benefit_categories
for each row execute function private.prevent_organisation_id_change();

create index benefit_categories_org_status_idx
  on public.benefit_categories (organisation_id, status, display_order);

alter table public.benefit_reporting_settings enable row level security;
alter table public.benefit_reporting_settings force row level security;
alter table public.benefit_categories enable row level security;
alter table public.benefit_categories force row level security;

revoke all on public.benefit_reporting_settings from public, anon, authenticated, service_role;
revoke all on public.benefit_categories from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.benefit_reporting_settings to lean_hub_private_owner;
grant select, insert, update, delete on public.benefit_categories to lean_hub_private_owner;

create policy private_owner_all_benefit_reporting_settings
on public.benefit_reporting_settings for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_benefit_categories
on public.benefit_categories for all to lean_hub_private_owner
using (true) with check (true);
