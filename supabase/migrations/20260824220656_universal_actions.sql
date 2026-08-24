create table public.actions (
  id uuid primary key,
  organisation_id uuid not null,
  title text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'normal',
  unit_id uuid,
  source_resource_id uuid,
  created_by_membership_id uuid not null,
  due_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  version integer not null default 1,
  idempotency_key text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint actions_organisation_id_id_key unique (organisation_id, id),
  constraint actions_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint actions_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint actions_source_resource_fkey
    foreign key (organisation_id, source_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint actions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint actions_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint actions_description_check
    check (description is null or char_length(description) <= 4000),
  constraint actions_status_check
    check (status in ('open', 'in_progress', 'completed', 'verified', 'cancelled')),
  constraint actions_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint actions_idempotency_key
    unique (organisation_id, idempotency_key)
);

create table public.action_assignees (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  membership_id uuid not null,
  assigned_by_membership_id uuid not null,
  assigned_at timestamptz not null default statement_timestamp(),
  constraint action_assignees_organisation_id_id_key unique (organisation_id, id),
  constraint action_assignees_action_member_key
    unique (organisation_id, action_id, membership_id),
  constraint action_assignees_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint action_assignees_member_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint action_assignees_assigner_fkey
    foreign key (organisation_id, assigned_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.action_status_transitions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  from_status text not null,
  to_status text not null,
  actor_membership_id uuid not null,
  reason text,
  created_at timestamptz not null default statement_timestamp(),
  constraint action_status_transitions_organisation_id_id_key
    unique (organisation_id, id),
  constraint action_status_transitions_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint action_status_transitions_actor_fkey
    foreign key (organisation_id, actor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create trigger actions_touch_updated_at
before update on public.actions
for each row execute function private.touch_updated_at();

create trigger actions_prevent_org_change
before update on public.actions
for each row execute function private.prevent_organisation_id_change();

create trigger action_status_transitions_prevent_update
before update on public.action_status_transitions
for each row execute function private.prevent_update_or_delete();

create trigger action_status_transitions_prevent_delete
before delete on public.action_status_transitions
for each row execute function private.prevent_update_or_delete();

create index actions_org_status_idx on public.actions (organisation_id, status);
create index action_assignees_action_idx on public.action_assignees (organisation_id, action_id);

alter table public.actions enable row level security;
alter table public.actions force row level security;
alter table public.action_assignees enable row level security;
alter table public.action_assignees force row level security;
alter table public.action_status_transitions enable row level security;
alter table public.action_status_transitions force row level security;

create or replace function private.action_visible_to_current_member(
  target_organisation_id uuid,
  target_action_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actions action_row
    where action_row.organisation_id = target_organisation_id
      and action_row.id = target_action_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'actions.read',
          null,
          null
        )
        or (
          action_row.unit_id is not null
          and private.has_scoped_permission(
            target_organisation_id,
            'actions.read',
            null,
            action_row.unit_id
          )
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'actions.read',
          action_row.created_by_membership_id,
          null
        )
        or exists (
          select 1
          from public.action_assignees assignee
          where assignee.organisation_id = action_row.organisation_id
            and assignee.action_id = action_row.id
            and private.has_scoped_permission(
              target_organisation_id,
              'actions.read',
              assignee.membership_id,
              null
            )
        )
      )
  )
$$;

create or replace function private.can_read_action(
  target_organisation_id uuid,
  target_action_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.action_visible_to_current_member(
    target_organisation_id,
    target_action_id
  )
$$;

create or replace function private.create_action(
  target_title text,
  target_description text default null,
  target_priority text default 'normal',
  target_unit_id uuid default null,
  target_source_resource_id uuid default null,
  target_due_at timestamptz default null,
  target_idempotency_key text default null
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
  new_action_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'actions.create', null, target_unit_id) then
    raise exception 'action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_source_resource_id is not null
    and not private.can_reference_source_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not authorised'
      using errcode = '42501';
  end if;

  if target_idempotency_key is not null then
    select action_row.id
    into new_action_id
    from public.actions action_row
    where action_row.organisation_id = org_id
      and action_row.idempotency_key = target_idempotency_key;

    if new_action_id is not null then
      return new_action_id;
    end if;
  end if;

  new_action_id := private.register_resource_record(
    org_id,
    'action',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.actions (
    id,
    organisation_id,
    title,
    description,
    priority,
    unit_id,
    source_resource_id,
    created_by_membership_id,
    due_at,
    idempotency_key
  )
  values (
    new_action_id,
    org_id,
    target_title,
    target_description,
    target_priority,
    target_unit_id,
    target_source_resource_id,
    actor_membership_id,
    target_due_at,
    target_idempotency_key
  );

  insert into public.action_status_transitions (
    organisation_id,
    action_id,
    from_status,
    to_status,
    actor_membership_id
  )
  values (
    org_id,
    new_action_id,
    'open',
    'open',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'action.created',
    new_action_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    new_action_id,
    'ActionCreated',
    coalesce(target_idempotency_key, new_action_id::text),
    jsonb_build_object('action_id', new_action_id)
  );

  return new_action_id;
end;
$$;

create or replace function public.create_action(
  target_title text,
  target_description text default null,
  target_priority text default 'normal',
  target_unit_id uuid default null,
  target_source_resource_id uuid default null,
  target_due_at timestamptz default null,
  target_idempotency_key text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_action(
    target_title,
    target_description,
    target_priority,
    target_unit_id,
    target_source_resource_id,
    target_due_at,
    target_idempotency_key
  )
$$;

create policy actions_select_visible
on public.actions
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.action_visible_to_current_member(organisation_id, id)
);

create policy action_assignees_select_visible
on public.action_assignees
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.action_visible_to_current_member(organisation_id, action_id)
);

create policy action_transitions_select_visible
on public.action_status_transitions
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.action_visible_to_current_member(organisation_id, action_id)
);

grant execute on function public.create_action(
  text, text, text, uuid, uuid, timestamptz, text
) to authenticated;

grant select on public.actions to authenticated;
grant select on public.action_assignees to authenticated;
grant select on public.action_status_transitions to authenticated;
