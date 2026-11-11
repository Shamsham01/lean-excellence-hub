-- Org-level labels and per-action checklist items for the Actions planner.
-- Direct table DML is denied (RLS, no policies); callers use SECURITY DEFINER RPCs only.
-- Database CI QA harness / hosted replacement jobs skip on migration-only PRs because
-- .github/workflows/ci-database.yml paths-filter does not include supabase/migrations/**.

create table public.action_labels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  name text not null,
  color text not null default '#0058FD',
  sort_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint action_labels_organisation_id_id_key unique (organisation_id, id),
  constraint action_labels_name_check
    check (name = btrim(name) and char_length(name) between 1 and 40),
  constraint action_labels_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index action_labels_org_name_lower_key
  on public.action_labels (organisation_id, lower(name));

create table public.action_label_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  label_id uuid not null,
  assigned_at timestamptz not null default statement_timestamp(),
  constraint action_label_assignments_organisation_id_id_key
    unique (organisation_id, id),
  constraint action_label_assignments_unique
    unique (organisation_id, action_id, label_id),
  constraint action_label_assignments_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint action_label_assignments_label_fkey
    foreign key (organisation_id, label_id)
    references public.action_labels(organisation_id, id)
    on delete restrict
);

create table public.action_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  completed_at timestamptz,
  completed_by_membership_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint action_checklist_items_organisation_id_id_key
    unique (organisation_id, id),
  constraint action_checklist_items_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint action_checklist_items_title_check
    check (title = btrim(title) and char_length(title) between 1 and 500),
  constraint action_checklist_items_completer_fkey
    foreign key (organisation_id, completed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

alter table public.actions
  add column if not exists card_cover_attachment_id uuid;

alter table public.actions
  add constraint actions_card_cover_attachment_fkey
    foreign key (organisation_id, card_cover_attachment_id)
    references public.attachments(organisation_id, id)
    on delete set null (card_cover_attachment_id);

create or replace function private.validate_action_card_cover_attachment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.card_cover_attachment_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.attachments attachment_row
    join public.resource_records resource_row
      on resource_row.organisation_id = attachment_row.organisation_id
     and resource_row.id = attachment_row.target_resource_id
    where attachment_row.organisation_id = new.organisation_id
      and attachment_row.id = new.card_cover_attachment_id
      and attachment_row.target_resource_id = new.id
      and resource_row.resource_type = 'action'
      and attachment_row.lifecycle = 'active'
  ) then
    raise exception 'card cover attachment must belong to this action'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger actions_validate_card_cover_attachment
before insert or update of card_cover_attachment_id
on public.actions
for each row
execute function private.validate_action_card_cover_attachment();

create index action_label_assignments_action_idx
  on public.action_label_assignments (organisation_id, action_id);

create index action_checklist_items_action_idx
  on public.action_checklist_items (organisation_id, action_id, sort_order);

create trigger action_labels_touch_updated_at
before update on public.action_labels
for each row execute function private.touch_updated_at();

create trigger action_checklist_items_touch_updated_at
before update on public.action_checklist_items
for each row execute function private.touch_updated_at();

alter table public.action_labels enable row level security;
alter table public.action_labels force row level security;
alter table public.action_label_assignments enable row level security;
alter table public.action_label_assignments force row level security;
alter table public.action_checklist_items enable row level security;
alter table public.action_checklist_items force row level security;

-- RLS enabled with force; no table policies — all access via SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------

create or replace function private.has_permission_any_unit_scope(
  target_organisation_id uuid,
  target_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = target_permission_key
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id =
        private.current_membership_id(target_organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
      and grant_row.scope_type in ('organisation', 'unit_subtree')
  )
  or private.membership_has_baseline_participation(
    private.current_membership_id(target_organisation_id),
    target_organisation_id,
    target_permission_key,
    null,
    null
  )
$$;

-- ---------------------------------------------------------------------------
-- Label catalogue RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_action_labels()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null then
    raise exception 'organisation context is required'
      using errcode = '42501';
  end if;

  if not private.has_permission_any_unit_scope(org_id, 'actions.read') then
    raise exception 'action labels are not authorised'
      using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', label_row.id,
          'name', label_row.name,
          'color', label_row.color,
          'sort_order', label_row.sort_order
        )
        order by label_row.sort_order, label_row.name
      )
      from public.action_labels label_row
      where label_row.organisation_id = org_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.upsert_action_label(
  target_label_id uuid default null,
  target_name text default null,
  target_color text default '#0058FD',
  target_sort_order integer default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  label_id uuid;
  is_create boolean := target_label_id is null;
begin
  if org_id is null then
    raise exception 'action label management is not authorised'
      using errcode = '42501';
  end if;

  if is_create then
    if not private.has_permission_any_unit_scope(org_id, 'actions.update') then
      raise exception 'action label management is not authorised'
        using errcode = '42501';
    end if;
  elsif not private.has_scoped_permission(org_id, 'actions.update', null, null) then
    raise exception 'action label management is not authorised'
      using errcode = '42501';
  end if;

  if target_name is null or btrim(target_name) = '' then
    raise exception 'label name is required'
      using errcode = '22023';
  end if;

  begin
    if is_create then
      insert into public.action_labels (
        organisation_id,
        name,
        color,
        sort_order
      )
      values (
        org_id,
        btrim(target_name),
        coalesce(nullif(btrim(target_color), ''), '#0058FD'),
        coalesce(target_sort_order, 0)
      )
      returning id into label_id;
    else
      update public.action_labels label_row
      set
        name = btrim(target_name),
        color = coalesce(nullif(btrim(target_color), ''), label_row.color),
        sort_order = coalesce(target_sort_order, label_row.sort_order)
      where label_row.organisation_id = org_id
        and label_row.id = target_label_id
      returning label_row.id into label_id;

      if not found then
        raise exception 'label not found'
          using errcode = 'P0002';
      end if;
    end if;
  exception
    when unique_violation then
      raise exception 'label name already exists'
        using errcode = '23505';
  end;

  return label_id;
end;
$$;

create or replace function public.set_action_labels(
  target_action_id uuid,
  target_label_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action label assignment is not authorised'
      using errcode = '42501';
  end if;

  delete from public.action_label_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.action_id = target_action_id
    and (
      target_label_ids is null
      or cardinality(target_label_ids) = 0
      or assignment_row.label_id <> all(target_label_ids)
    );

  if target_label_ids is not null and cardinality(target_label_ids) > 0 then
    insert into public.action_label_assignments (
      organisation_id,
      action_id,
      label_id
    )
    select org_id, target_action_id, label_id
    from unnest(coalesce(target_label_ids, array[]::uuid[])) as label_id
    where label_id is not null
      and exists (
      select 1
      from public.action_labels label_row
      where label_row.organisation_id = org_id
        and label_row.id = label_id
    )
    on conflict on constraint action_label_assignments_unique do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checklist RPCs
-- ---------------------------------------------------------------------------

create or replace function public.add_action_checklist_item(
  target_action_id uuid,
  target_title text,
  target_sort_order integer default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  next_order integer;
  new_id uuid;
  item_count integer;
begin
  if org_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'checklist edit is not authorised'
      using errcode = '42501';
  end if;

  if target_title is null or btrim(target_title) = '' then
    raise exception 'checklist title is required'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into item_count
  from public.action_checklist_items item_row
  where item_row.organisation_id = org_id
    and item_row.action_id = target_action_id;

  if item_count >= 100 then
    raise exception 'checklist item limit reached'
      using errcode = '22023';
  end if;

  if target_sort_order is null then
    select coalesce(max(item_row.sort_order) + 1, 0)
    into next_order
    from public.action_checklist_items item_row
    where item_row.organisation_id = org_id
      and item_row.action_id = target_action_id;
  else
    next_order := greatest(0, least(target_sort_order, item_count));
  end if;

  insert into public.action_checklist_items (
    organisation_id,
    action_id,
    title,
    sort_order
  )
  values (
    org_id,
    target_action_id,
    btrim(target_title),
    next_order
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.set_action_checklist_item_done(
  target_item_id uuid,
  target_done boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_id uuid := private.current_membership_id(org_id);
  item_row public.action_checklist_items%rowtype;
begin
  select *
  into item_row
  from public.action_checklist_items
  where organisation_id = org_id
    and id = target_item_id;

  if not found then
    raise exception 'checklist item not found'
      using errcode = 'P0002';
  end if;

  if not private.can_update_action(org_id, item_row.action_id) then
    raise exception 'checklist edit is not authorised'
      using errcode = '42501';
  end if;

  update public.action_checklist_items
  set
    is_done = target_done,
    completed_at = case when target_done then statement_timestamp() else null end,
    completed_by_membership_id = case when target_done then actor_id else null end
  where organisation_id = org_id
    and id = target_item_id;
end;
$$;

create or replace function public.delete_action_checklist_item(
  target_item_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  item_row public.action_checklist_items%rowtype;
begin
  select *
  into item_row
  from public.action_checklist_items
  where organisation_id = org_id
    and id = target_item_id;

  if not found then
    raise exception 'checklist item not found'
      using errcode = 'P0002';
  end if;

  if not private.can_update_action(org_id, item_row.action_id) then
    raise exception 'checklist edit is not authorised'
      using errcode = '42501';
  end if;

  delete from public.action_checklist_items
  where organisation_id = org_id
    and id = target_item_id;
end;
$$;

create or replace function public.move_action_checklist_item(
  target_item_id uuid,
  target_sort_order integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  item_row public.action_checklist_items%rowtype;
  item_count integer;
  old_order integer;
  new_order integer;
begin
  select *
  into item_row
  from public.action_checklist_items
  where organisation_id = org_id
    and id = target_item_id;

  if not found then
    raise exception 'checklist item not found'
      using errcode = 'P0002';
  end if;

  if not private.can_update_action(org_id, item_row.action_id) then
    raise exception 'checklist edit is not authorised'
      using errcode = '42501';
  end if;

  select count(*)::integer
  into item_count
  from public.action_checklist_items
  where organisation_id = org_id
    and action_id = item_row.action_id;

  old_order := item_row.sort_order;
  new_order := greatest(0, least(target_sort_order, greatest(item_count - 1, 0)));

  if new_order = old_order then
    return;
  end if;

  if new_order < old_order then
    update public.action_checklist_items sibling_row
    set sort_order = sibling_row.sort_order + 1
    where sibling_row.organisation_id = org_id
      and sibling_row.action_id = item_row.action_id
      and sibling_row.id <> target_item_id
      and sibling_row.sort_order >= new_order
      and sibling_row.sort_order < old_order;
  else
    update public.action_checklist_items sibling_row
    set sort_order = sibling_row.sort_order - 1
    where sibling_row.organisation_id = org_id
      and sibling_row.action_id = item_row.action_id
      and sibling_row.id <> target_item_id
      and sibling_row.sort_order > old_order
      and sibling_row.sort_order <= new_order;
  end if;

  update public.action_checklist_items
  set sort_order = new_order
  where organisation_id = org_id
    and id = target_item_id;
end;
$$;

create or replace function public.set_action_card_cover_attachment(
  target_action_id uuid,
  target_attachment_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action cover update is not authorised'
      using errcode = '42501';
  end if;

  update public.actions
  set card_cover_attachment_id = target_attachment_id
  where organisation_id = org_id
    and id = target_action_id;
end;
$$;

-- Extend get_action_detail with planner fields
create or replace function public.get_action_detail(
  target_action_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  action_row public.actions%rowtype;
  creator_name text;
  unit_name text;
  assignees jsonb;
  history jsonb;
  labels jsonb;
  checklist jsonb;
  comment_count integer;
  cover jsonb;
begin
  if org_id is null
    or not private.can_read_action(org_id, target_action_id) then
    raise exception 'action detail is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  select nullif(
    btrim(coalesce(membership_row.display_name, profile_row.display_name, '')),
    ''
  )
  into creator_name
  from public.organisation_memberships membership_row
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where membership_row.organisation_id = org_id
    and membership_row.id = action_row.created_by_membership_id;

  select unit_row.name
  into unit_name
  from public.organisation_units unit_row
  where unit_row.organisation_id = org_id
    and unit_row.id = action_row.unit_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'membership_id', assignee_row.membership_id,
        'display_name', coalesce(
          nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name, '')), ''),
          'Team member'
        ),
        'assigned_at', assignee_row.assigned_at
      )
      order by assignee_row.assigned_at
    ),
    '[]'::jsonb
  )
  into assignees
  from public.action_assignees assignee_row
  left join public.organisation_memberships membership_row
    on membership_row.organisation_id = assignee_row.organisation_id
   and membership_row.id = assignee_row.membership_id
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where assignee_row.organisation_id = org_id
    and assignee_row.action_id = target_action_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', transition_row.id,
        'from_status', transition_row.from_status,
        'to_status', transition_row.to_status,
        'reason', transition_row.reason,
        'created_at', transition_row.created_at,
        'actor_membership_id', transition_row.actor_membership_id,
        'actor_display_name', coalesce(
          nullif(btrim(coalesce(actor_membership.display_name, actor_profile.display_name, '')), ''),
          'Team member'
        )
      )
      order by transition_row.created_at, transition_row.id
    ),
    '[]'::jsonb
  )
  into history
  from public.action_status_transitions transition_row
  left join public.organisation_memberships actor_membership
    on actor_membership.organisation_id = transition_row.organisation_id
   and actor_membership.id = transition_row.actor_membership_id
  left join public.profiles actor_profile
    on actor_profile.user_id = actor_membership.user_id
  where transition_row.organisation_id = org_id
    and transition_row.action_id = target_action_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', label_row.id,
        'name', label_row.name,
        'color', label_row.color
      )
      order by label_row.sort_order, label_row.name
    ),
    '[]'::jsonb
  )
  into labels
  from public.action_label_assignments assignment_row
  join public.action_labels label_row
    on label_row.organisation_id = assignment_row.organisation_id
   and label_row.id = assignment_row.label_id
  where assignment_row.organisation_id = org_id
    and assignment_row.action_id = target_action_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item_row.id,
        'title', item_row.title,
        'is_done', item_row.is_done,
        'sort_order', item_row.sort_order,
        'completed_at', item_row.completed_at
      )
      order by item_row.sort_order, item_row.created_at
    ),
    '[]'::jsonb
  )
  into checklist
  from public.action_checklist_items item_row
  where item_row.organisation_id = org_id
    and item_row.action_id = target_action_id;

  select count(*)::integer
  into comment_count
  from public.comments comment_row
  where comment_row.organisation_id = org_id
    and comment_row.target_resource_id = target_action_id;

  select case
    when action_row.card_cover_attachment_id is null then null
    else jsonb_build_object(
      'id', attachment_row.id,
      'filename', attachment_row.filename,
      'mime_type', attachment_row.mime_type,
      'storage_object_path', attachment_row.storage_object_path
    )
  end
  into cover
  from public.attachments attachment_row
  join public.resource_records resource_row
    on resource_row.organisation_id = attachment_row.organisation_id
   and resource_row.id = attachment_row.target_resource_id
  where attachment_row.organisation_id = org_id
    and attachment_row.id = action_row.card_cover_attachment_id
    and attachment_row.target_resource_id = target_action_id
    and resource_row.resource_type = 'action'
    and attachment_row.lifecycle = 'active';

  return jsonb_build_object(
    'id', action_row.id,
    'action_number', action_row.action_number,
    'title', action_row.title,
    'description', action_row.description,
    'status', action_row.status,
    'priority', action_row.priority,
    'due_at', action_row.due_at,
    'completed_at', action_row.completed_at,
    'verified_at', action_row.verified_at,
    'unit_id', action_row.unit_id,
    'unit_name', unit_name,
    'site_unit_id', action_row.site_unit_id,
    'source_resource_id', action_row.source_resource_id,
    'source', private.action_source_summary(org_id, action_row.source_resource_id),
    'created_by_membership_id', action_row.created_by_membership_id,
    'created_by_display_name', coalesce(creator_name, 'Team member'),
    'created_at', action_row.created_at,
    'updated_at', action_row.updated_at,
    'version', action_row.version,
    'assignees', assignees,
    'status_history', history,
    'labels', labels,
    'checklist_items', checklist,
    'comment_count', coalesce(comment_count, 0),
    'card_cover_attachment', cover,
    'permissions', jsonb_build_object(
      'can_update', private.can_update_action(org_id, target_action_id),
      'can_assign', private.can_assign_action(org_id, target_action_id),
      'can_complete', private.can_complete_action(org_id, target_action_id),
      'can_start', private.can_transition_action_status(org_id, target_action_id, 'in_progress'),
      'can_reopen', private.can_update_action(org_id, target_action_id),
      'can_cancel', private.can_update_action(org_id, target_action_id)
    )
  );
end;
$$;

alter function private.has_permission_any_unit_scope(uuid, text)
  owner to lean_hub_private_owner;

revoke all on function private.has_permission_any_unit_scope(uuid, text)
  from public, anon;

grant execute on function private.has_permission_any_unit_scope(uuid, text)
  to authenticated;

alter function private.validate_action_card_cover_attachment()
  owner to lean_hub_private_owner;

revoke all on function private.validate_action_card_cover_attachment()
  from public, anon;

revoke all on function public.list_action_labels() from public, anon;
revoke all on function public.upsert_action_label(uuid, text, text, integer) from public, anon;
revoke all on function public.set_action_labels(uuid, uuid[]) from public, anon;
revoke all on function public.add_action_checklist_item(uuid, text, integer) from public, anon;
revoke all on function public.set_action_checklist_item_done(uuid, boolean) from public, anon;
revoke all on function public.delete_action_checklist_item(uuid) from public, anon;
revoke all on function public.move_action_checklist_item(uuid, integer) from public, anon;
revoke all on function public.set_action_card_cover_attachment(uuid, uuid) from public, anon;

grant execute on function public.list_action_labels() to authenticated;
grant execute on function public.upsert_action_label(uuid, text, text, integer) to authenticated;
grant execute on function public.set_action_labels(uuid, uuid[]) to authenticated;
grant execute on function public.add_action_checklist_item(uuid, text, integer) to authenticated;
grant execute on function public.set_action_checklist_item_done(uuid, boolean) to authenticated;
grant execute on function public.delete_action_checklist_item(uuid) to authenticated;
grant execute on function public.move_action_checklist_item(uuid, integer) to authenticated;
grant execute on function public.set_action_card_cover_attachment(uuid, uuid) to authenticated;
