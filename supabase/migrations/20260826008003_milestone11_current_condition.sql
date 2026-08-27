-- Milestone 11: current condition items, evidence links (initial columns).

create table public.problem_solving_current_condition_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  category text not null,
  statement text not null,
  status text not null default 'active',
  supersedes_item_id uuid,
  superseded_at timestamptz,
  verified_by_membership_id uuid,
  verified_at timestamptz,
  verification_rationale text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_current_condition_items_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_current_condition_items_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_current_condition_items_supersedes_fkey
    foreign key (organisation_id, supersedes_item_id)
    references public.problem_solving_current_condition_items(organisation_id, id)
    on delete restrict,
  constraint problem_solving_current_condition_items_verified_by_fkey
    foreign key (organisation_id, verified_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_current_condition_items_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_current_condition_items_category_check
    check (category in ('observation', 'measured_fact', 'recorded_fact', 'assumption', 'constraint_context')),
  constraint problem_solving_current_condition_items_status_check
    check (status in ('active', 'superseded')),
  constraint problem_solving_current_condition_items_superseded_check
    check (
      (status = 'active' and supersedes_item_id is null and superseded_at is null)
      or (status = 'superseded' and superseded_at is not null)
    ),
  constraint problem_solving_current_condition_items_statement_check
    check (statement = btrim(statement) and char_length(statement) between 1 and 2000),
  constraint problem_solving_current_condition_items_verified_check
    check (
      (verified_at is null and verified_by_membership_id is null and verification_rationale is null)
      or (verified_at is not null and verified_by_membership_id is not null)
    )
);

-- Prevent category change from assumption to fact types without supersession.
create or replace function private.guard_current_condition_category_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.category = 'assumption'
    and new.category in ('measured_fact', 'recorded_fact')
    and new.status <> 'superseded' then
    raise exception 'assumption cannot be reclassified to fact without supersession; create a new item that supersedes it'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger problem_solving_current_condition_items_guard_category_change
before update on public.problem_solving_current_condition_items
for each row
when (old.category is distinct from new.category)
execute function private.guard_current_condition_category_change();

create trigger problem_solving_current_condition_items_prevent_org_change
before update on public.problem_solving_current_condition_items
for each row execute function private.prevent_organisation_id_change();

-- Indexes
create index problem_solving_current_condition_items_case_idx
  on public.problem_solving_current_condition_items (organisation_id, case_id, status);

-- RLS
alter table public.problem_solving_current_condition_items enable row level security;
alter table public.problem_solving_current_condition_items force row level security;

revoke all on public.problem_solving_current_condition_items from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_current_condition_items to lean_hub_private_owner;

create policy private_owner_all_problem_solving_current_condition_items
on public.problem_solving_current_condition_items for all to lean_hub_private_owner
using (true) with check (true);

create policy problem_solving_current_condition_items_select
on public.problem_solving_current_condition_items for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

grant select on public.problem_solving_current_condition_items to authenticated;

-- Evidence links table: initial columns for current_condition_item_id and is_case_level.
-- Other subject FK columns (containment_id, hypothesis_id, etc.) added in later migrations via ALTER.
create table public.problem_solving_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  attachment_id uuid not null,
  current_condition_item_id uuid,
  is_case_level boolean not null default false,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_evidence_links_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_evidence_links_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_evidence_links_attachment_fkey
    foreign key (organisation_id, attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint problem_solving_evidence_links_condition_item_fkey
    foreign key (organisation_id, current_condition_item_id)
    references public.problem_solving_current_condition_items(organisation_id, id)
    on delete restrict,
  constraint problem_solving_evidence_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_evidence_links_exact_one_subject_check
    check (
      (
        (case when current_condition_item_id is not null then 1 else 0 end)
        + (case when is_case_level = true then 1 else 0 end)
      ) = 1
    )
);

create trigger problem_solving_evidence_links_prevent_org_change
before update on public.problem_solving_evidence_links
for each row execute function private.prevent_organisation_id_change();

create index problem_solving_evidence_links_case_idx
  on public.problem_solving_evidence_links (organisation_id, problem_solving_case_id);
create index problem_solving_evidence_links_condition_item_idx
  on public.problem_solving_evidence_links (organisation_id, current_condition_item_id)
  where current_condition_item_id is not null;

alter table public.problem_solving_evidence_links enable row level security;
alter table public.problem_solving_evidence_links force row level security;

revoke all on public.problem_solving_evidence_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_evidence_links to lean_hub_private_owner;

create policy private_owner_all_problem_solving_evidence_links
on public.problem_solving_evidence_links for all to lean_hub_private_owner
using (true) with check (true);

create policy problem_solving_evidence_links_select
on public.problem_solving_evidence_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, problem_solving_case_id)
);

grant select on public.problem_solving_evidence_links to authenticated;

-- RPCs

create or replace function private.create_current_condition_item(
  target_case_id uuid,
  target_category text,
  target_statement text,
  target_supersedes_item_id uuid default null
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
  case_row public.problem_solving_cases%rowtype;
  new_item_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'current condition item creation is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'cannot add items to a closed or cancelled case'
      using errcode = '55000';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.contribute', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.contribute', null, case_row.organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, case_row.organisation_unit_id)
    or (case_row.owner_membership_id = actor_membership_id)
    or (case_row.facilitator_membership_id = actor_membership_id)
  ) then
    raise exception 'current condition item creation is not authorised'
      using errcode = '42501';
  end if;

  if target_supersedes_item_id is not null then
    update public.problem_solving_current_condition_items
    set status = 'superseded',
        superseded_at = statement_timestamp()
    where organisation_id = org_id
      and id = target_supersedes_item_id
      and case_id = target_case_id
      and status = 'active';

    if not found then
      raise exception 'superseded item not found or already superseded'
        using errcode = 'P0002';
    end if;
  end if;

  insert into public.problem_solving_current_condition_items (
    organisation_id,
    case_id,
    category,
    statement,
    status,
    supersedes_item_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_category,
    btrim(target_statement),
    'active',
    null,
    actor_membership_id
  )
  returning id into new_item_id;

  return new_item_id;
end;
$$;

create or replace function private.verify_current_condition_item(
  target_item_id uuid,
  target_verification_rationale text default null
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
  item_row public.problem_solving_current_condition_items%rowtype;
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'verification is not authorised'
      using errcode = '42501';
  end if;

  select item_table.*
  into item_row
  from public.problem_solving_current_condition_items item_table
  where item_table.organisation_id = org_id
    and item_table.id = target_item_id
  for update;

  if not found then
    raise exception 'current condition item not found'
      using errcode = 'P0002';
  end if;

  if item_row.status <> 'active' then
    raise exception 'only active items can be verified'
      using errcode = '55000';
  end if;

  if item_row.verified_at is not null then
    raise exception 'item is already verified'
      using errcode = '55000';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = item_row.case_id;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.verify_cause', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.verify_cause', null, case_row.organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
  ) then
    raise exception 'verification is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_current_condition_items
  set verified_by_membership_id = actor_membership_id,
      verified_at = statement_timestamp(),
      verification_rationale = target_verification_rationale
  where organisation_id = org_id
    and id = target_item_id;

  return true;
end;
$$;

create or replace function private.link_problem_solving_evidence(
  target_case_id uuid,
  target_attachment_id uuid,
  target_current_condition_item_id uuid default null,
  target_is_case_level boolean default false
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
  case_row public.problem_solving_cases%rowtype;
  new_link_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'evidence link is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'cannot link evidence to a closed or cancelled case'
      using errcode = '55000';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.contribute', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.contribute', null, case_row.organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or (case_row.owner_membership_id = actor_membership_id)
    or (case_row.facilitator_membership_id = actor_membership_id)
  ) then
    raise exception 'evidence link is not authorised'
      using errcode = '42501';
  end if;

  if target_current_condition_item_id is not null then
    if not exists (
      select 1
      from public.problem_solving_current_condition_items item_row
      where item_row.organisation_id = org_id
        and item_row.id = target_current_condition_item_id
        and item_row.case_id = target_case_id
    ) then
      raise exception 'current condition item does not belong to this case'
        using errcode = '22023';
    end if;
  end if;

  if not exists (
    select 1
    from public.attachments att
    where att.organisation_id = org_id
      and att.id = target_attachment_id
  ) then
    raise exception 'attachment not found in this organisation'
      using errcode = 'P0002';
  end if;

  insert into public.problem_solving_evidence_links (
    organisation_id,
    problem_solving_case_id,
    attachment_id,
    current_condition_item_id,
    is_case_level,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_attachment_id,
    target_current_condition_item_id,
    target_is_case_level,
    actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

-- Public wrappers
create or replace function public.create_current_condition_item(
  target_case_id uuid,
  target_category text,
  target_statement text,
  target_supersedes_item_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_current_condition_item(
  target_case_id,
  target_category,
  target_statement,
  target_supersedes_item_id
) $$;

create or replace function public.verify_current_condition_item(
  target_item_id uuid,
  target_verification_rationale text default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.verify_current_condition_item(
  target_item_id,
  target_verification_rationale
) $$;

-- Grants
grant execute on function public.create_current_condition_item(uuid, text, text, uuid) to authenticated;
grant execute on function public.verify_current_condition_item(uuid, text) to authenticated;

revoke all on function public.create_current_condition_item(uuid, text, text, uuid) from public, anon;
revoke all on function public.verify_current_condition_item(uuid, text) from public, anon;

-- Ownership
alter function private.guard_current_condition_category_change() owner to lean_hub_private_owner;
alter function private.create_current_condition_item(uuid, text, text, uuid) owner to lean_hub_private_owner;
alter function private.verify_current_condition_item(uuid, text) owner to lean_hub_private_owner;
alter function private.link_problem_solving_evidence(uuid, uuid, uuid, boolean) owner to lean_hub_private_owner;
