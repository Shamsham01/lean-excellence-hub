-- Milestone 10: improvement benefits domain, status history, submission snapshots, source links.

create table public.improvement_benefits (
  id uuid primary key,
  organisation_id uuid not null,
  benefit_number text,
  title text not null,
  description text,
  benefit_class text not null,
  financial_type text,
  non_financial_type text,
  category_id uuid,
  organisational_unit_id uuid not null,
  owner_membership_id uuid not null,
  created_by_membership_id uuid not null,
  reporting_currency_snapshot text,
  baseline_description text,
  baseline_period_start date,
  baseline_period_end date,
  baseline_measure_value numeric,
  baseline_measure_unit text,
  baseline_financial_value numeric,
  planned_realisation_start date,
  planned_realisation_end date,
  status text not null default 'draft',
  is_standalone_initiative boolean not null default false,
  current_forecast_version_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint improvement_benefits_organisation_id_id_key unique (organisation_id, id),
  constraint improvement_benefits_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint improvement_benefits_category_fkey
    foreign key (organisation_id, category_id)
    references public.benefit_categories(organisation_id, id)
    on delete restrict,
  constraint improvement_benefits_unit_fkey
    foreign key (organisation_id, organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint improvement_benefits_owner_fkey
    foreign key (organisation_id, owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint improvement_benefits_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint improvement_benefits_number_org_key unique (organisation_id, benefit_number),
  constraint improvement_benefits_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint improvement_benefits_description_check
    check (description is null or char_length(description) <= 8000),
  constraint improvement_benefits_benefit_class_check
    check (benefit_class in ('financial', 'non_financial')),
  constraint improvement_benefits_financial_type_check
    check (
      financial_type is null
      or financial_type in (
        'hard_saving',
        'soft_saving',
        'cost_avoidance',
        'revenue_gain',
        'other_financial'
      )
    ),
  constraint improvement_benefits_non_financial_type_check
    check (
      non_financial_type is null
      or non_financial_type in (
        'quality',
        'delivery',
        'safety',
        'people',
        'sustainability',
        'other_non_financial'
      )
    ),
  constraint improvement_benefits_class_type_check
    check (
      (
        benefit_class = 'financial'
        and financial_type is not null
        and non_financial_type is null
      )
      or (
        benefit_class = 'non_financial'
        and non_financial_type is not null
        and financial_type is null
      )
    ),
  constraint improvement_benefits_currency_semantics_check
    check (
      (
        benefit_class = 'financial'
        and (
          reporting_currency_snapshot is null
          or reporting_currency_snapshot ~ '^[A-Z]{3}$'
        )
      )
      or (
        benefit_class = 'non_financial'
        and reporting_currency_snapshot is null
        and baseline_financial_value is null
      )
    ),
  constraint improvement_benefits_baseline_period_check
    check (
      baseline_period_start is null
      or baseline_period_end is null
      or baseline_period_end >= baseline_period_start
    ),
  constraint improvement_benefits_planned_realisation_check
    check (
      planned_realisation_start is null
      or planned_realisation_end is null
      or planned_realisation_end >= planned_realisation_start
    ),
  constraint improvement_benefits_status_check
    check (
      status in (
        'draft',
        'submitted',
        'approved',
        'realising',
        'realised',
        'rejected',
        'withdrawn',
        'cancelled'
      )
    )
);

create table public.benefit_status_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  benefit_id uuid not null,
  from_status text not null,
  to_status text not null,
  changed_by_membership_id uuid not null,
  reason text,
  changed_at timestamptz not null default statement_timestamp(),
  constraint benefit_status_history_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_status_history_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_status_history_actor_fkey
    foreign key (organisation_id, changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.benefit_submission_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  benefit_id uuid not null,
  benefit_number text not null,
  title text not null,
  description text,
  benefit_class text not null,
  financial_type text,
  non_financial_type text,
  category_id uuid,
  category_name_snapshot text,
  category_code_snapshot text,
  organisational_unit_id uuid not null,
  unit_name_snapshot text not null,
  unit_code_snapshot text not null,
  owner_membership_id uuid not null,
  owner_display_name_snapshot text,
  baseline_description text,
  baseline_period_start date,
  baseline_period_end date,
  baseline_measure_value numeric,
  baseline_measure_unit text,
  baseline_financial_value numeric,
  source_links_summary jsonb not null default '[]'::jsonb,
  forecast_version_id uuid,
  forecast_total_amount numeric,
  target_measure_value numeric,
  target_measure_unit text,
  target_date date,
  reporting_currency_snapshot text,
  planned_realisation_start date,
  planned_realisation_end date,
  is_standalone_initiative boolean not null default false,
  submitted_by_membership_id uuid not null,
  submitted_at timestamptz not null default statement_timestamp(),
  constraint benefit_submission_snapshots_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_submission_snapshots_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_submission_snapshots_submitter_fkey
    foreign key (organisation_id, submitted_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_submission_snapshots_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint benefit_submission_snapshots_benefit_class_check
    check (benefit_class in ('financial', 'non_financial')),
  constraint benefit_submission_snapshots_source_links_summary_check
    check (jsonb_typeof(source_links_summary) = 'array')
);

create table public.benefit_source_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  benefit_id uuid not null,
  source_resource_id uuid not null,
  relationship_role text not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint benefit_source_links_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_source_links_benefit_source_key
    unique (organisation_id, benefit_id, source_resource_id),
  constraint benefit_source_links_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_source_links_source_fkey
    foreign key (organisation_id, source_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint benefit_source_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_source_links_role_check
    check (relationship_role in ('primary', 'contributing'))
);

create unique index benefit_source_links_primary_unique_idx
  on public.benefit_source_links (organisation_id, benefit_id)
  where relationship_role = 'primary';

create or replace function private.benefit_is_editable(target_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_status = 'draft'
$$;

create or replace function private.prevent_non_draft_benefit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    if new.benefit_number is distinct from old.benefit_number
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.benefit_class is distinct from old.benefit_class
      or new.financial_type is distinct from old.financial_type
      or new.non_financial_type is distinct from old.non_financial_type
      or new.category_id is distinct from old.category_id
      or new.organisational_unit_id is distinct from old.organisational_unit_id
      or new.owner_membership_id is distinct from old.owner_membership_id
      or new.created_by_membership_id is distinct from old.created_by_membership_id
      or new.reporting_currency_snapshot is distinct from old.reporting_currency_snapshot
      or new.baseline_description is distinct from old.baseline_description
      or new.baseline_period_start is distinct from old.baseline_period_start
      or new.baseline_period_end is distinct from old.baseline_period_end
      or new.baseline_measure_value is distinct from old.baseline_measure_value
      or new.baseline_measure_unit is distinct from old.baseline_measure_unit
      or new.baseline_financial_value is distinct from old.baseline_financial_value
      or new.planned_realisation_start is distinct from old.planned_realisation_start
      or new.planned_realisation_end is distinct from old.planned_realisation_end
      or new.is_standalone_initiative is distinct from old.is_standalone_initiative then
      raise exception 'non-draft benefit content is immutable'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.prevent_benefit_source_link_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  benefit_status text;
  target_benefit_id uuid;
  target_org_id uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'benefit source links are immutable'
      using errcode = '55000';
  end if;

  target_benefit_id := coalesce(new.benefit_id, old.benefit_id);
  target_org_id := coalesce(new.organisation_id, old.organisation_id);

  select benefit_row.status
  into benefit_status
  from public.improvement_benefits benefit_row
  where benefit_row.organisation_id = target_org_id
    and benefit_row.id = target_benefit_id;

  if benefit_status is distinct from 'draft' then
    raise exception 'benefit source links are only mutable while draft'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger improvement_benefits_prevent_non_draft_mutation
before update on public.improvement_benefits
for each row execute function private.prevent_non_draft_benefit_mutation();

create trigger improvement_benefits_touch_updated_at
before update on public.improvement_benefits
for each row execute function private.touch_updated_at();

create trigger improvement_benefits_prevent_org_change
before update on public.improvement_benefits
for each row execute function private.prevent_organisation_id_change();

create trigger benefit_status_history_prevent_update
before update on public.benefit_status_history
for each row execute function private.prevent_update_or_delete();

create trigger benefit_status_history_prevent_delete
before delete on public.benefit_status_history
for each row execute function private.prevent_update_or_delete();

create trigger benefit_submission_snapshots_prevent_update
before update on public.benefit_submission_snapshots
for each row execute function private.prevent_update_or_delete();

create trigger benefit_submission_snapshots_prevent_delete
before delete on public.benefit_submission_snapshots
for each row execute function private.prevent_update_or_delete();

create trigger benefit_source_links_prevent_mutation
before insert or update or delete on public.benefit_source_links
for each row execute function private.prevent_benefit_source_link_mutation();

create trigger benefit_source_links_prevent_org_change
before update on public.benefit_source_links
for each row execute function private.prevent_organisation_id_change();

create index improvement_benefits_org_status_idx
  on public.improvement_benefits (organisation_id, status);
create index improvement_benefits_org_unit_idx
  on public.improvement_benefits (organisation_id, organisational_unit_id);
create index improvement_benefits_org_owner_idx
  on public.improvement_benefits (organisation_id, owner_membership_id);
create index improvement_benefits_org_class_idx
  on public.improvement_benefits (organisation_id, benefit_class, status);
create index benefit_status_history_benefit_idx
  on public.benefit_status_history (organisation_id, benefit_id, changed_at);
create index benefit_submission_snapshots_benefit_idx
  on public.benefit_submission_snapshots (organisation_id, benefit_id, submitted_at);
create index benefit_source_links_benefit_idx
  on public.benefit_source_links (organisation_id, benefit_id);
create index benefit_source_links_source_idx
  on public.benefit_source_links (organisation_id, source_resource_id);

alter table public.improvement_benefits enable row level security;
alter table public.improvement_benefits force row level security;
alter table public.benefit_status_history enable row level security;
alter table public.benefit_status_history force row level security;
alter table public.benefit_submission_snapshots enable row level security;
alter table public.benefit_submission_snapshots force row level security;
alter table public.benefit_source_links enable row level security;
alter table public.benefit_source_links force row level security;

revoke all on public.improvement_benefits from public, anon, authenticated, service_role;
revoke all on public.benefit_status_history from public, anon, authenticated, service_role;
revoke all on public.benefit_submission_snapshots from public, anon, authenticated, service_role;
revoke all on public.benefit_source_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.improvement_benefits to lean_hub_private_owner;
grant select, insert, update, delete on public.benefit_status_history to lean_hub_private_owner;
grant select, insert, update, delete on public.benefit_submission_snapshots to lean_hub_private_owner;
grant select, insert, update, delete on public.benefit_source_links to lean_hub_private_owner;

create policy private_owner_all_improvement_benefits
on public.improvement_benefits for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_benefit_status_history
on public.benefit_status_history for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_benefit_submission_snapshots
on public.benefit_submission_snapshots for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_benefit_source_links
on public.benefit_source_links for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.append_benefit_status_history(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_from_status text,
  target_to_status text,
  target_actor_membership_id uuid,
  target_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.benefit_status_history (
    organisation_id,
    benefit_id,
    from_status,
    to_status,
    changed_by_membership_id,
    reason
  ) values (
    target_organisation_id,
    target_benefit_id,
    target_from_status,
    target_to_status,
    target_actor_membership_id,
    target_reason
  );
end;
$$;

create or replace function private.can_read_improvement_benefit(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = target_organisation_id
      and benefit_row.id = target_benefit_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          null,
          benefit_row.organisational_unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          benefit_row.owner_membership_id,
          null
        )
      )
  )
$$;

create or replace function private.can_manage_benefit_in_unit(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.manage',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.manage',
    null,
    target_unit_id
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.create',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.create',
    null,
    target_unit_id
  )
$$;

create or replace function private.can_edit_benefit_draft(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = target_organisation_id
      and benefit_row.id = target_benefit_id
      and benefit_row.status = 'draft'
      and (
        benefit_row.owner_membership_id = private.current_membership_id(target_organisation_id)
        or private.can_manage_benefit_in_unit(
          target_organisation_id,
          benefit_row.organisational_unit_id
        )
      )
  )
$$;

create or replace function private.link_benefit_primary_source(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_source_resource_id uuid,
  target_actor_membership_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_link_id uuid;
begin
  if not private.can_edit_benefit_draft(target_organisation_id, target_benefit_id) then
    raise exception 'benefit primary source link is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_reference_source_resource(
    target_organisation_id,
    target_source_resource_id
  ) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  delete from public.benefit_source_links link_row
  where link_row.organisation_id = target_organisation_id
    and link_row.benefit_id = target_benefit_id
    and (
      link_row.relationship_role = 'primary'
      or link_row.source_resource_id = target_source_resource_id
    );

  insert into public.benefit_source_links (
    organisation_id,
    benefit_id,
    source_resource_id,
    relationship_role,
    created_by_membership_id
  )
  values (
    target_organisation_id,
    target_benefit_id,
    target_source_resource_id,
    'primary',
    target_actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

create or replace function private.create_benefit_draft(
  target_title text,
  target_organisational_unit_id uuid,
  target_benefit_class text,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_owner_membership_id uuid default null,
  target_is_standalone_initiative boolean default false,
  target_primary_source_resource_id uuid default null
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
  resolved_owner_membership_id uuid;
  reporting_currency text;
  new_benefit_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_in_unit(org_id, target_organisational_unit_id) then
    raise exception 'benefit draft creation is not authorised'
      using errcode = '42501';
  end if;

  if target_benefit_class = 'financial' then
    if target_financial_type is null or target_non_financial_type is not null then
      raise exception 'financial benefit requires a financial type'
        using errcode = '22023';
    end if;
  elsif target_benefit_class = 'non_financial' then
    if target_non_financial_type is null or target_financial_type is not null then
      raise exception 'non-financial benefit requires a non-financial type'
        using errcode = '22023';
    end if;
  else
    raise exception 'invalid benefit class'
      using errcode = '22023';
  end if;

  if target_is_standalone_initiative and target_primary_source_resource_id is not null then
    raise exception 'standalone benefits cannot have a primary source at creation'
      using errcode = '22023';
  end if;

  if target_primary_source_resource_id is not null
    and not private.can_reference_source_resource(org_id, target_primary_source_resource_id) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  if target_benefit_class = 'financial' then
    select organisation.reporting_currency
    into reporting_currency
    from public.organisations organisation
    where organisation.id = org_id;
  else
    reporting_currency := null;
  end if;

  new_benefit_id := private.register_resource_record(
    org_id,
    'improvement_benefit',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.improvement_benefits (
    id,
    organisation_id,
    title,
    description,
    benefit_class,
    financial_type,
    non_financial_type,
    category_id,
    organisational_unit_id,
    owner_membership_id,
    created_by_membership_id,
    reporting_currency_snapshot,
    status,
    is_standalone_initiative
  )
  values (
    new_benefit_id,
    org_id,
    btrim(target_title),
    target_description,
    target_benefit_class,
    target_financial_type,
    target_non_financial_type,
    target_category_id,
    target_organisational_unit_id,
    resolved_owner_membership_id,
    actor_membership_id,
    reporting_currency,
    'draft',
    target_is_standalone_initiative
  );

  perform private.append_benefit_status_history(
    org_id,
    new_benefit_id,
    'draft',
    'draft',
    actor_membership_id,
    'created'
  );

  if target_primary_source_resource_id is not null then
    perform private.link_benefit_primary_source(
      org_id,
      new_benefit_id,
      target_primary_source_resource_id,
      actor_membership_id
    );
  end if;

  perform private.append_business_audit(
    org_id,
    'benefit.draft_created',
    new_benefit_id,
    'succeeded',
    jsonb_build_object('benefit_class', target_benefit_class)
  );

  perform private.enqueue_domain_event(
    org_id,
    new_benefit_id,
    'BenefitDraftCreated',
    new_benefit_id::text,
    jsonb_build_object('benefit_id', new_benefit_id)
  );

  return new_benefit_id;
end;
$$;

create or replace function private.update_benefit_draft(
  target_benefit_id uuid,
  target_title text,
  target_description text default null,
  target_benefit_class text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null,
  target_baseline_description text default null,
  target_baseline_period_start date default null,
  target_baseline_period_end date default null,
  target_baseline_measure_value numeric default null,
  target_baseline_measure_unit text default null,
  target_baseline_financial_value numeric default null,
  target_planned_realisation_start date default null,
  target_planned_realisation_end date default null,
  target_is_standalone_initiative boolean default null
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
  benefit_row public.improvement_benefits%rowtype;
  next_benefit_class text;
  next_financial_type text;
  next_non_financial_type text;
  next_reporting_currency text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit update is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit update is not authorised'
      using errcode = '42501';
  end if;

  if target_organisational_unit_id is not null
    and not private.can_manage_benefit_in_unit(org_id, target_organisational_unit_id) then
    raise exception 'target unit is not within manage scope'
      using errcode = '42501';
  end if;

  next_benefit_class := coalesce(target_benefit_class, benefit_row.benefit_class);
  next_financial_type := case
    when next_benefit_class = 'financial'
      then coalesce(target_financial_type, benefit_row.financial_type)
    else null
  end;
  next_non_financial_type := case
    when next_benefit_class = 'non_financial'
      then coalesce(target_non_financial_type, benefit_row.non_financial_type)
    else null
  end;

  if next_benefit_class = 'financial' then
    if next_financial_type is null or next_non_financial_type is not null then
      raise exception 'financial benefit requires a financial type'
        using errcode = '22023';
    end if;

    select organisation.reporting_currency
    into next_reporting_currency
    from public.organisations organisation
    where organisation.id = org_id;
  elsif next_benefit_class = 'non_financial' then
    if next_non_financial_type is null or next_financial_type is not null then
      raise exception 'non-financial benefit requires a non-financial type'
        using errcode = '22023';
    end if;

    next_reporting_currency := null;
  else
    raise exception 'invalid benefit class'
      using errcode = '22023';
  end if;

  if coalesce(target_is_standalone_initiative, benefit_row.is_standalone_initiative)
    and exists (
      select 1
      from public.benefit_source_links link_row
      where link_row.organisation_id = org_id
        and link_row.benefit_id = target_benefit_id
    ) then
    raise exception 'standalone benefits cannot retain source links'
      using errcode = '22023';
  end if;

  update public.improvement_benefits benefit_table
  set title = btrim(target_title),
      description = target_description,
      benefit_class = next_benefit_class,
      financial_type = next_financial_type,
      non_financial_type = next_non_financial_type,
      category_id = coalesce(target_category_id, benefit_row.category_id),
      organisational_unit_id = coalesce(
        target_organisational_unit_id,
        benefit_row.organisational_unit_id
      ),
      owner_membership_id = coalesce(
        target_owner_membership_id,
        benefit_row.owner_membership_id
      ),
      reporting_currency_snapshot = next_reporting_currency,
      baseline_description = target_baseline_description,
      baseline_period_start = target_baseline_period_start,
      baseline_period_end = target_baseline_period_end,
      baseline_measure_value = case
        when next_benefit_class = 'non_financial'
          then coalesce(target_baseline_measure_value, benefit_row.baseline_measure_value)
        else null
      end,
      baseline_measure_unit = case
        when next_benefit_class = 'non_financial'
          then coalesce(target_baseline_measure_unit, benefit_row.baseline_measure_unit)
        else null
      end,
      baseline_financial_value = case
        when next_benefit_class = 'financial'
          then coalesce(target_baseline_financial_value, benefit_row.baseline_financial_value)
        else null
      end,
      planned_realisation_start = target_planned_realisation_start,
      planned_realisation_end = target_planned_realisation_end,
      is_standalone_initiative = coalesce(
        target_is_standalone_initiative,
        benefit_row.is_standalone_initiative
      ),
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  return true;
end;
$$;

create or replace function private.add_benefit_source_link(
  target_benefit_id uuid,
  target_source_resource_id uuid,
  target_relationship_role text default 'contributing'
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
  benefit_row public.improvement_benefits%rowtype;
  new_link_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit source link is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit source links are only mutable while draft'
      using errcode = '55000';
  end if;

  if not private.can_edit_benefit_draft(org_id, target_benefit_id) then
    raise exception 'benefit source link is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.is_standalone_initiative then
    raise exception 'standalone benefits cannot have source links'
      using errcode = '22023';
  end if;

  if target_relationship_role = 'primary' then
    return private.link_benefit_primary_source(
      org_id,
      target_benefit_id,
      target_source_resource_id,
      actor_membership_id
    );
  end if;

  if not private.can_reference_source_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  insert into public.benefit_source_links (
    organisation_id,
    benefit_id,
    source_resource_id,
    relationship_role,
    created_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    target_source_resource_id,
    target_relationship_role,
    actor_membership_id
  )
  on conflict (organisation_id, benefit_id, source_resource_id) do nothing
  returning id into new_link_id;

  if new_link_id is null then
    select link_row.id
    into new_link_id
    from public.benefit_source_links link_row
    where link_row.organisation_id = org_id
      and link_row.benefit_id = target_benefit_id
      and link_row.source_resource_id = target_source_resource_id;
  end if;

  return new_link_id;
end;
$$;

create or replace function private.remove_benefit_source_link(
  target_benefit_id uuid,
  target_source_resource_id uuid
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
  benefit_row public.improvement_benefits%rowtype;
  deleted_count integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit source link removal is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit source links are only mutable while draft'
      using errcode = '55000';
  end if;

  if not private.can_edit_benefit_draft(org_id, target_benefit_id) then
    raise exception 'benefit source link removal is not authorised'
      using errcode = '42501';
  end if;

  delete from public.benefit_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.benefit_id = target_benefit_id
    and link_row.source_resource_id = target_source_resource_id;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

grant select on public.improvement_benefits to authenticated;
grant select on public.benefit_status_history to authenticated;
grant select on public.benefit_submission_snapshots to authenticated;
grant select on public.benefit_source_links to authenticated;

create policy improvement_benefits_select
on public.improvement_benefits for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, id)
);

create policy benefit_status_history_select
on public.benefit_status_history for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

create policy benefit_submission_snapshots_select
on public.benefit_submission_snapshots for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

create policy benefit_source_links_select
on public.benefit_source_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

create or replace function public.create_benefit_draft(
  target_title text,
  target_organisational_unit_id uuid,
  target_benefit_class text,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_owner_membership_id uuid default null,
  target_is_standalone_initiative boolean default false,
  target_primary_source_resource_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_benefit_draft(
  target_title,
  target_organisational_unit_id,
  target_benefit_class,
  target_description,
  target_financial_type,
  target_non_financial_type,
  target_category_id,
  target_owner_membership_id,
  target_is_standalone_initiative,
  target_primary_source_resource_id
) $$;

create or replace function public.update_benefit_draft(
  target_benefit_id uuid,
  target_title text,
  target_description text default null,
  target_benefit_class text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null,
  target_baseline_description text default null,
  target_baseline_period_start date default null,
  target_baseline_period_end date default null,
  target_baseline_measure_value numeric default null,
  target_baseline_measure_unit text default null,
  target_baseline_financial_value numeric default null,
  target_planned_realisation_start date default null,
  target_planned_realisation_end date default null,
  target_is_standalone_initiative boolean default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.update_benefit_draft(
  target_benefit_id,
  target_title,
  target_description,
  target_benefit_class,
  target_financial_type,
  target_non_financial_type,
  target_category_id,
  target_organisational_unit_id,
  target_owner_membership_id,
  target_baseline_description,
  target_baseline_period_start,
  target_baseline_period_end,
  target_baseline_measure_value,
  target_baseline_measure_unit,
  target_baseline_financial_value,
  target_planned_realisation_start,
  target_planned_realisation_end,
  target_is_standalone_initiative
) $$;

create or replace function public.add_benefit_source_link(
  target_benefit_id uuid,
  target_source_resource_id uuid,
  target_relationship_role text default 'contributing'
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.add_benefit_source_link(
  target_benefit_id,
  target_source_resource_id,
  target_relationship_role
) $$;

create or replace function public.remove_benefit_source_link(
  target_benefit_id uuid,
  target_source_resource_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.remove_benefit_source_link(
  target_benefit_id,
  target_source_resource_id
) $$;

grant execute on function public.create_benefit_draft(
  text, uuid, text, text, text, text, uuid, uuid, boolean, uuid
) to authenticated;
grant execute on function public.update_benefit_draft(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, date, date, numeric, text, numeric, date, date, boolean
) to authenticated;
grant execute on function public.add_benefit_source_link(uuid, uuid, text) to authenticated;
grant execute on function public.remove_benefit_source_link(uuid, uuid) to authenticated;

revoke all on function private.create_benefit_draft(
  text, uuid, text, text, text, text, uuid, uuid, boolean, uuid
) from public;
revoke all on function private.update_benefit_draft(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, date, date, numeric, text, numeric, date, date, boolean
) from public;
revoke all on function private.add_benefit_source_link(uuid, uuid, text) from public;
revoke all on function private.remove_benefit_source_link(uuid, uuid) from public;
revoke all on function private.link_benefit_primary_source(uuid, uuid, uuid, uuid) from public;

grant execute on function private.create_benefit_draft(
  text, uuid, text, text, text, text, uuid, uuid, boolean, uuid
) to lean_hub_private_owner;
grant execute on function private.update_benefit_draft(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, date, date, numeric, text, numeric, date, date, boolean
) to lean_hub_private_owner;
grant execute on function private.add_benefit_source_link(uuid, uuid, text) to lean_hub_private_owner;
grant execute on function private.remove_benefit_source_link(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.link_benefit_primary_source(uuid, uuid, uuid, uuid) to lean_hub_private_owner;

alter function private.append_benefit_status_history(uuid, uuid, text, text, uuid, text)
  owner to lean_hub_private_owner;
alter function private.can_read_improvement_benefit(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_manage_benefit_in_unit(uuid, uuid) owner to lean_hub_private_owner;
alter function private.benefit_is_editable(text) owner to lean_hub_private_owner;
alter function private.can_edit_benefit_draft(uuid, uuid) owner to lean_hub_private_owner;
alter function private.prevent_non_draft_benefit_mutation() owner to lean_hub_private_owner;
alter function private.prevent_benefit_source_link_mutation() owner to lean_hub_private_owner;
alter function private.create_benefit_draft(
  text, uuid, text, text, text, text, uuid, uuid, boolean, uuid
) owner to lean_hub_private_owner;
alter function private.update_benefit_draft(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, date, date, numeric, text, numeric, date, date, boolean
) owner to lean_hub_private_owner;
alter function private.add_benefit_source_link(uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.remove_benefit_source_link(uuid, uuid) owner to lean_hub_private_owner;
alter function private.link_benefit_primary_source(uuid, uuid, uuid, uuid) owner to lean_hub_private_owner;
