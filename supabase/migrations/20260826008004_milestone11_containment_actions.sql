-- Milestone 11: containment actions, problem-solving action context, evidence link extensions.

-- ──────────────────────────────────────────────────────────────
-- problem_solving_containments
-- ──────────────────────────────────────────────────────────────

create table public.problem_solving_containments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  description text not null,
  rationale text,
  status text not null default 'proposed',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  implemented_at timestamptz,
  is_still_required boolean not null default true,
  released_at timestamptz,
  release_rationale text,
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_containments_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_containments_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_containments_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_containments_description_check
    check (description = btrim(description) and char_length(description) between 1 and 2000),
  constraint problem_solving_containments_rationale_check
    check (rationale is null or char_length(rationale) <= 4000),
  constraint problem_solving_containments_release_rationale_check
    check (release_rationale is null or char_length(release_rationale) <= 4000),
  constraint problem_solving_containments_status_check
    check (status in ('proposed', 'active', 'released')),
  constraint problem_solving_containments_released_semantics_check
    check (status <> 'released' or released_at is not null),
  constraint problem_solving_containments_active_semantics_check
    check (status = 'proposed' or implemented_at is not null)
);

-- ──────────────────────────────────────────────────────────────
-- problem_solving_action_context
-- ──────────────────────────────────────────────────────────────

create table public.problem_solving_action_context (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  action_id uuid not null,
  context_role text not null,
  containment_id uuid,
  countermeasure_id uuid,
  sustainment_item_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_action_context_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_action_context_action_key
    unique (organisation_id, action_id),
  constraint problem_solving_action_context_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint problem_solving_action_context_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_action_context_containment_fkey
    foreign key (organisation_id, containment_id)
    references public.problem_solving_containments(organisation_id, id)
    on delete restrict,
  constraint problem_solving_action_context_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_action_context_role_check
    check (context_role in ('containment', 'countermeasure', 'sustainment')),
  constraint problem_solving_action_context_role_fk_check
    check (
      (
        context_role = 'containment'
        and containment_id is not null
        and countermeasure_id is null
        and sustainment_item_id is null
      )
      or (
        context_role = 'countermeasure'
        and countermeasure_id is not null
        and containment_id is null
        and sustainment_item_id is null
      )
      or (
        context_role = 'sustainment'
        and sustainment_item_id is not null
        and containment_id is null
        and countermeasure_id is null
      )
    )
);

-- ──────────────────────────────────────────────────────────────
-- Triggers
-- ──────────────────────────────────────────────────────────────

create trigger problem_solving_containments_touch_updated_at
before update on public.problem_solving_containments
for each row execute function private.touch_updated_at();

create trigger problem_solving_containments_prevent_org_change
before update on public.problem_solving_containments
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_action_context_prevent_org_change
before update on public.problem_solving_action_context
for each row execute function private.prevent_organisation_id_change();

-- ──────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────

create index problem_solving_containments_case_idx
  on public.problem_solving_containments (organisation_id, problem_solving_case_id);
create index problem_solving_containments_status_idx
  on public.problem_solving_containments (organisation_id, status);
create index problem_solving_action_context_case_idx
  on public.problem_solving_action_context (organisation_id, problem_solving_case_id);
create index problem_solving_action_context_containment_idx
  on public.problem_solving_action_context (organisation_id, containment_id)
  where containment_id is not null;

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

alter table public.problem_solving_containments enable row level security;
alter table public.problem_solving_containments force row level security;
alter table public.problem_solving_action_context enable row level security;
alter table public.problem_solving_action_context force row level security;

revoke all on public.problem_solving_containments from public, anon, authenticated, service_role;
revoke all on public.problem_solving_action_context from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_containments to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_action_context to lean_hub_private_owner;

create policy private_owner_all_problem_solving_containments
on public.problem_solving_containments for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_action_context
on public.problem_solving_action_context for all to lean_hub_private_owner
using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- Private helpers
-- ──────────────────────────────────────────────────────────────

create or replace function private.append_containment_status_change(
  target_organisation_id uuid,
  target_containment_id uuid,
  target_event_key text,
  target_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  case_id uuid;
begin
  select c.problem_solving_case_id
  into case_id
  from public.problem_solving_containments c
  where c.organisation_id = target_organisation_id
    and c.id = target_containment_id;

  if case_id is null then
    raise exception 'containment not found'
      using errcode = 'P0002';
  end if;

  perform private.append_business_audit(
    target_organisation_id,
    target_event_key,
    case_id,
    'succeeded',
    target_detail || jsonb_build_object('containment_id', target_containment_id)
  );
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – create_containment
-- ──────────────────────────────────────────────────────────────

create or replace function private.create_containment(
  target_problem_solving_case_id uuid,
  target_description text,
  target_rationale text default null
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
  new_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'containment creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_containments (
    organisation_id,
    problem_solving_case_id,
    description,
    rationale,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    btrim(target_description),
    target_rationale,
    'proposed',
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'containment.created',
    target_problem_solving_case_id,
    'succeeded',
    jsonb_build_object('containment_id', new_id, 'case_id', target_problem_solving_case_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_problem_solving_case_id,
    'ContainmentCreated',
    new_id::text,
    jsonb_build_object(
      'containment_id', new_id,
      'case_id', target_problem_solving_case_id
    )
  );

  return new_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – update_containment
-- ──────────────────────────────────────────────────────────────

create or replace function private.update_containment(
  target_containment_id uuid,
  target_description text default null,
  target_rationale text default null,
  target_is_still_required boolean default null
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
  containment_row public.problem_solving_containments%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'containment update is not authorised'
      using errcode = '42501';
  end if;

  select c.*
  into containment_row
  from public.problem_solving_containments c
  where c.organisation_id = org_id
    and c.id = target_containment_id
  for update;

  if not found then
    raise exception 'containment not found'
      using errcode = 'P0002';
  end if;

  if containment_row.status = 'released' then
    raise exception 'released containments are immutable'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    containment_row.problem_solving_case_id
  ) then
    raise exception 'containment update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_containments c
  set description   = coalesce(btrim(target_description), c.description),
      rationale      = coalesce(target_rationale, c.rationale),
      is_still_required = coalesce(target_is_still_required, c.is_still_required),
      updated_at     = statement_timestamp()
  where c.organisation_id = org_id
    and c.id = target_containment_id;

  perform private.append_business_audit(
    org_id,
    'containment.updated',
    containment_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object('containment_id', target_containment_id)
  );

  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – release_containment
-- ──────────────────────────────────────────────────────────────

create or replace function private.release_containment(
  target_containment_id uuid,
  target_release_rationale text default null
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
  containment_row public.problem_solving_containments%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'containment release is not authorised'
      using errcode = '42501';
  end if;

  select c.*
  into containment_row
  from public.problem_solving_containments c
  where c.organisation_id = org_id
    and c.id = target_containment_id
  for update;

  if not found then
    raise exception 'containment not found'
      using errcode = 'P0002';
  end if;

  if containment_row.status = 'released' then
    raise exception 'containment is already released'
      using errcode = '55000';
  end if;

  if containment_row.status = 'proposed' then
    raise exception 'proposed containments cannot be released without activation'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    containment_row.problem_solving_case_id
  ) then
    raise exception 'containment release is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_containments c
  set status            = 'released',
      is_still_required = false,
      released_at       = statement_timestamp(),
      release_rationale = target_release_rationale,
      updated_at        = statement_timestamp()
  where c.organisation_id = org_id
    and c.id = target_containment_id;

  perform private.append_business_audit(
    org_id,
    'containment.released',
    containment_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'containment_id', target_containment_id,
      'release_rationale', target_release_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    containment_row.problem_solving_case_id,
    'ContainmentReleased',
    target_containment_id::text,
    jsonb_build_object(
      'containment_id', target_containment_id,
      'case_id', containment_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – create_problem_solving_action
-- ──────────────────────────────────────────────────────────────

create or replace function private.create_problem_solving_action(
  target_title text,
  target_problem_solving_case_id uuid,
  target_context_role text,
  target_containment_id uuid default null,
  target_countermeasure_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
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
  case_unit_id uuid;
  new_action_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'problem-solving action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_context_role not in ('containment', 'countermeasure', 'sustainment') then
    raise exception 'invalid context role'
      using errcode = '22023';
  end if;

  if target_context_role = 'containment' and target_containment_id is null then
    raise exception 'containment actions require a containment_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'countermeasure' and target_countermeasure_id is null then
    raise exception 'countermeasure actions require a countermeasure_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'sustainment' and target_sustainment_item_id is null then
    raise exception 'sustainment actions require a sustainment_item_id'
      using errcode = '22023';
  end if;

  select case_row.organisation_unit_id
  into case_unit_id
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_problem_solving_case_id;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    case_unit_id,
    target_problem_solving_case_id,
    target_due_at,
    null
  );

  insert into public.problem_solving_action_context (
    organisation_id,
    problem_solving_case_id,
    action_id,
    context_role,
    containment_id,
    countermeasure_id,
    sustainment_item_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    new_action_id,
    target_context_role,
    target_containment_id,
    target_countermeasure_id,
    target_sustainment_item_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- Authenticated RLS policies
-- ──────────────────────────────────────────────────────────────

grant select on public.problem_solving_containments to authenticated;
grant select on public.problem_solving_action_context to authenticated;

create policy problem_solving_containments_select
on public.problem_solving_containments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, problem_solving_case_id)
);

create policy problem_solving_action_context_select
on public.problem_solving_action_context for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, problem_solving_case_id)
);

-- ──────────────────────────────────────────────────────────────
-- Public wrappers
-- ──────────────────────────────────────────────────────────────

create or replace function public.create_containment(
  target_problem_solving_case_id uuid,
  target_description text,
  target_rationale text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_containment(
  target_problem_solving_case_id,
  target_description,
  target_rationale
) $$;

create or replace function public.update_containment(
  target_containment_id uuid,
  target_description text default null,
  target_rationale text default null,
  target_is_still_required boolean default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.update_containment(
  target_containment_id,
  target_description,
  target_rationale,
  target_is_still_required
) $$;

create or replace function public.release_containment(
  target_containment_id uuid,
  target_release_rationale text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.release_containment(
  target_containment_id,
  target_release_rationale
) $$;

create or replace function public.create_problem_solving_action(
  target_title text,
  target_problem_solving_case_id uuid,
  target_context_role text,
  target_containment_id uuid default null,
  target_countermeasure_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_problem_solving_action(
  target_title,
  target_problem_solving_case_id,
  target_context_role,
  target_containment_id,
  target_countermeasure_id,
  target_sustainment_item_id,
  target_description,
  target_priority,
  target_due_at
) $$;

-- ──────────────────────────────────────────────────────────────
-- Grants
-- ──────────────────────────────────────────────────────────────

grant execute on function public.create_containment(uuid, text, text) to authenticated;
grant execute on function public.update_containment(uuid, text, text, boolean) to authenticated;
grant execute on function public.release_containment(uuid, text) to authenticated;
grant execute on function public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz
) to authenticated;

revoke all on function public.create_containment(uuid, text, text) from public, anon;
revoke all on function public.update_containment(uuid, text, text, boolean) from public, anon;
revoke all on function public.release_containment(uuid, text) from public, anon;
revoke all on function public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz
) from public, anon;

revoke all on function private.create_containment(uuid, text, text) from public;
revoke all on function private.update_containment(uuid, text, text, boolean) from public;
revoke all on function private.release_containment(uuid, text) from public;
revoke all on function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz
) from public;

grant execute on function private.create_containment(uuid, text, text) to lean_hub_private_owner;
grant execute on function private.update_containment(uuid, text, text, boolean) to lean_hub_private_owner;
grant execute on function private.release_containment(uuid, text) to lean_hub_private_owner;
grant execute on function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz
) to lean_hub_private_owner;

-- ──────────────────────────────────────────────────────────────
-- Function ownership
-- ──────────────────────────────────────────────────────────────

alter function private.append_containment_status_change(uuid, uuid, text, jsonb)
  owner to lean_hub_private_owner;
alter function private.create_containment(uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.update_containment(uuid, text, text, boolean)
  owner to lean_hub_private_owner;
alter function private.release_containment(uuid, text)
  owner to lean_hub_private_owner;
alter function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz
) owner to lean_hub_private_owner;

-- ──────────────────────────────────────────────────────────────
-- ALTER evidence_links – add containment_id FK
-- ──────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_solving_evidence_links'
      and column_name = 'containment_id'
  ) then
    alter table public.problem_solving_evidence_links
      add column containment_id uuid;

    alter table public.problem_solving_evidence_links
      add constraint problem_solving_evidence_links_containment_fkey
        foreign key (organisation_id, containment_id)
        references public.problem_solving_containments(organisation_id, id)
        on delete restrict;

    create index problem_solving_evidence_links_containment_idx
      on public.problem_solving_evidence_links (organisation_id, containment_id)
      where containment_id is not null;
  end if;
end;
$$;
