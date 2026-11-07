-- In-app notifications for platform users (per-membership rows, org-scoped RLS).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  notification_type text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  dedupe_key text not null,
  constraint in_app_notifications_organisation_id_id_key unique (organisation_id, id),
  constraint in_app_notifications_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete cascade,
  constraint in_app_notifications_title_check
    check (title = btrim(title) and char_length(title) between 1 and 300),
  constraint in_app_notifications_body_check
    check (body is null or char_length(body) <= 4000),
  constraint in_app_notifications_href_check
    check (
      href is null
      or (
        href = btrim(href)
        and char_length(href) between 1 and 2000
        and left(href, 1) = '/'
      )
    ),
  constraint in_app_notifications_type_check
    check (
      notification_type = btrim(notification_type)
      and char_length(notification_type) between 1 and 80
    ),
  constraint in_app_notifications_dedupe_org_key unique (organisation_id, membership_id, dedupe_key),
  constraint in_app_notifications_dedupe_key_check
    check (
      dedupe_key = btrim(dedupe_key)
      and char_length(dedupe_key) between 1 and 500
    )
);

comment on table public.in_app_notifications is
  'User-visible in-app notifications. Rows are per active membership; use dedupe_key for upserts.';

create index in_app_notifications_org_member_created_idx
  on public.in_app_notifications (organisation_id, membership_id, created_at desc);

create index in_app_notifications_org_member_unread_idx
  on public.in_app_notifications (organisation_id, membership_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- RLS & grants (mirror leanai_* tenant tables)
-- ---------------------------------------------------------------------------

alter table public.in_app_notifications enable row level security;
alter table public.in_app_notifications force row level security;

revoke all on public.in_app_notifications from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.in_app_notifications to lean_hub_private_owner;
grant select, update on public.in_app_notifications to authenticated;

create policy private_owner_all_in_app_notifications
on public.in_app_notifications for all to lean_hub_private_owner
using (true) with check (true);

create policy in_app_notifications_select_own
on public.in_app_notifications for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
);

create policy in_app_notifications_update_own
on public.in_app_notifications for update to authenticated
using (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
)
with check (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
);

-- ---------------------------------------------------------------------------
-- Private insert helper (dedupe upsert, used from triggers + maintenance RPC)
-- ---------------------------------------------------------------------------

create or replace function private.insert_membership_in_app_notification(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_notification_type text,
  target_title text,
  target_body text,
  target_href text,
  target_dedupe_key text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  membership_status text;
  new_id uuid;
begin
  select membership_row.status
  into membership_status
  from public.organisation_memberships membership_row
  where membership_row.organisation_id = target_organisation_id
    and membership_row.id = target_membership_id;

  if membership_status is distinct from 'active' then
    return null;
  end if;

  insert into public.in_app_notifications (
    organisation_id,
    membership_id,
    notification_type,
    title,
    body,
    href,
    dedupe_key
  ) values (
    target_organisation_id,
    target_membership_id,
    btrim(target_notification_type),
    btrim(target_title),
    target_body,
    target_href,
    btrim(target_dedupe_key)
  )
  on conflict (organisation_id, membership_id, dedupe_key) do update set
    title = excluded.title,
    body = excluded.body,
    href = excluded.href,
    notification_type = excluded.notification_type
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function private.insert_membership_in_app_notification(
  uuid, uuid, text, text, text, text, text
) from public;

grant execute on function private.insert_membership_in_app_notification(
  uuid, uuid, text, text, text, text, text
) to postgres;

alter function private.insert_membership_in_app_notification(
  uuid, uuid, text, text, text, text, text
) owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Suggestion workflow: notify on status transitions (from history rows)
-- ---------------------------------------------------------------------------

create or replace function private.notify_in_app_for_suggestion_status_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  suggestion_title text;
  suggestion_number text;
  author_id uuid;
  jurisdiction_unit uuid;
  resource_href text;
  display_label text;
  body_text text;
  dedupe text;
  type_key text;
  mgr record;
begin
  select
    coalesce(nullif(btrim(suggestion_row.suggestion_number), ''), suggestion_row.title),
    suggestion_row.title,
    suggestion_row.author_membership_id,
    suggestion_row.review_jurisdiction_unit_id
  into suggestion_number, suggestion_title, author_id, jurisdiction_unit
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = new.organisation_id
    and suggestion_row.id = new.suggestion_id;

  if suggestion_title is null then
    return new;
  end if;

  display_label := coalesce(nullif(suggestion_number, suggestion_title), suggestion_title);
  resource_href := '/platform/suggestions/' || new.suggestion_id::text;

  -- Managers: submitted for review (exclude author as actor)
  if new.to_status = 'submitted'
     and new.changed_by_membership_id is distinct from author_id then
    for mgr in
      select distinct membership_row.id as id
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = new.organisation_id
        and membership_row.status = 'active'
        and membership_row.id is distinct from new.changed_by_membership_id
        and (
          private.can_assign_suggestion_reviewer(new.organisation_id, jurisdiction_unit)
          or private.membership_can_review_suggestion_jurisdiction(
            new.organisation_id,
            membership_row.id,
            jurisdiction_unit
          )
        )
    loop
      perform private.insert_membership_in_app_notification(
        new.organisation_id,
        mgr.id,
        'suggestions.awaiting_review',
        'Idea submitted for review',
        display_label || ' was submitted and is waiting for review.',
        '/platform/suggestions/review?queue=all&suggestionId=' || new.suggestion_id::text,
        'suggestion:' || new.suggestion_id::text || ':submitted'
      );
    end loop;
  end if;

  -- Author: status updates (skip if the author triggered a non-useful transition)
  if author_id is null then
    return new;
  end if;

  if new.to_status = 'under_review' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_under_review';
    body_text := display_label || ' is now under review.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:under_review';
  elsif new.to_status = 'accepted' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_accepted';
    body_text := display_label || ' was accepted.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:accepted';
  elsif new.to_status = 'rejected' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_rejected';
    body_text := display_label || ' was declined.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:rejected';
  elsif new.to_status = 'parked' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_parked';
    body_text := display_label || ' was parked for further consideration.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:parked';
  elsif new.to_status = 'implemented' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_implemented';
    body_text := display_label || ' was marked implemented.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:implemented';
  elsif new.to_status = 'withdrawn' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_withdrawn';
    body_text := display_label || ' was withdrawn.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:withdrawn';
  else
    return new;
  end if;

  perform private.insert_membership_in_app_notification(
    new.organisation_id,
    author_id,
    type_key,
    case new.to_status
      when 'under_review' then 'Idea under review'
      when 'accepted' then 'Idea accepted'
      when 'rejected' then 'Idea declined'
      when 'parked' then 'Idea parked'
      when 'implemented' then 'Idea implemented'
      when 'withdrawn' then 'Idea withdrawn'
      else 'Idea updated'
    end,
    body_text,
    resource_href,
    dedupe
  );

  return new;
end;
$$;

revoke all on function private.notify_in_app_for_suggestion_status_change() from public;
grant execute on function private.notify_in_app_for_suggestion_status_change() to postgres;
alter function private.notify_in_app_for_suggestion_status_change() owner to lean_hub_private_owner;

create trigger suggestion_status_history_in_app_notifications
after insert on public.suggestion_status_history
for each row execute function private.notify_in_app_for_suggestion_status_change();

-- ---------------------------------------------------------------------------
-- Overdue action assignees: align rows with current overdue set (called from app)
-- Public SQL wrappers + private implementations match other migrations: CI cannot
-- `alter function public.* owner to lean_hub_private_owner` under hardened
-- `public` schema grants.
-- ---------------------------------------------------------------------------

create or replace function private.sync_overdue_action_chase_notifications()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_id uuid;
  affected integer := 0;
begin
  if org_id is null then
    raise exception 'sync overdue notifications is not authorised'
      using errcode = '42501';
  end if;

  actor_id := private.current_membership_id(org_id);
  if actor_id is null then
    raise exception 'sync overdue notifications is not authorised'
      using errcode = '42501';
  end if;

  with overdue as (
    select
      action_row.organisation_id as organisation_id,
      assignee_row.membership_id as membership_id,
      action_row.id as action_id,
      action_row.title as action_title,
      action_row.due_at as due_at
    from public.actions action_row
    join public.action_assignees assignee_row
      on assignee_row.organisation_id = action_row.organisation_id
     and assignee_row.action_id = action_row.id
    where action_row.organisation_id = org_id
      and action_row.status in ('open', 'in_progress')
      and action_row.due_at is not null
      and action_row.due_at < statement_timestamp()
  ),
  upserted as (
    insert into public.in_app_notifications (
      organisation_id,
      membership_id,
      notification_type,
      title,
      body,
      href,
      dedupe_key
    )
    select
      overdue.organisation_id,
      overdue.membership_id,
      'leanai.chase_overdue_action',
      'Overdue action',
      left(
        btrim(overdue.action_title) || ' was due '
        || to_char(overdue.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        4000
      ),
      '/platform/actions/' || overdue.action_id::text,
      'overdue_action:' || overdue.action_id::text || ':' || overdue.membership_id::text
    from overdue
    on conflict (organisation_id, membership_id, dedupe_key) do update set
      title = excluded.title,
      body = excluded.body,
      href = excluded.href,
      notification_type = excluded.notification_type
    returning 1
  )
  select count(*) into affected from upserted;

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = org_id
    and notification_row.membership_id = actor_id
    and notification_row.notification_type = 'leanai.chase_overdue_action'
    and notification_row.dedupe_key like 'overdue_action:%'
    and not exists (
      select 1
      from public.actions action_row
      join public.action_assignees assignee_row
        on assignee_row.organisation_id = action_row.organisation_id
       and assignee_row.action_id = action_row.id
      where action_row.organisation_id = org_id
        and assignee_row.membership_id = actor_id
        and action_row.status in ('open', 'in_progress')
        and action_row.due_at is not null
        and action_row.due_at < statement_timestamp()
        and notification_row.dedupe_key = (
          'overdue_action:' || action_row.id::text || ':' || actor_id::text
        )
    );

  return coalesce(affected, 0);
end;
$$;

revoke all on function private.sync_overdue_action_chase_notifications() from public;
grant execute on function private.sync_overdue_action_chase_notifications() to postgres;

alter function private.sync_overdue_action_chase_notifications() owner to lean_hub_private_owner;

create or replace function public.sync_overdue_action_chase_notifications()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.sync_overdue_action_chase_notifications()
$$;

revoke all on function public.sync_overdue_action_chase_notifications() from public, anon;
grant execute on function public.sync_overdue_action_chase_notifications() to authenticated;

create or replace function private.mark_in_app_notification_read(target_notification_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_id uuid;
begin
  if org_id is null then
    raise exception 'mark notification read is not authorised'
      using errcode = '42501';
  end if;

  actor_id := private.current_membership_id(org_id);
  if actor_id is null then
    raise exception 'mark notification read is not authorised'
      using errcode = '42501';
  end if;

  update public.in_app_notifications notification_row
  set read_at = coalesce(notification_row.read_at, statement_timestamp())
  where notification_row.organisation_id = org_id
    and notification_row.id = target_notification_id
    and notification_row.membership_id = actor_id;

  return found;
end;
$$;

revoke all on function private.mark_in_app_notification_read(uuid) from public;
grant execute on function private.mark_in_app_notification_read(uuid) to postgres;

alter function private.mark_in_app_notification_read(uuid) owner to lean_hub_private_owner;

create or replace function public.mark_in_app_notification_read(target_notification_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.mark_in_app_notification_read(target_notification_id)
$$;

revoke all on function public.mark_in_app_notification_read(uuid) from public, anon;
grant execute on function public.mark_in_app_notification_read(uuid) to authenticated;

create or replace function private.mark_all_in_app_notifications_read()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_id uuid;
begin
  if org_id is null then
    raise exception 'mark notifications read is not authorised'
      using errcode = '42501';
  end if;

  actor_id := private.current_membership_id(org_id);
  if actor_id is null then
    raise exception 'mark notifications read is not authorised'
      using errcode = '42501';
  end if;

  update public.in_app_notifications notification_row
  set read_at = coalesce(notification_row.read_at, statement_timestamp())
  where notification_row.organisation_id = org_id
    and notification_row.membership_id = actor_id
    and notification_row.read_at is null;

  return true;
end;
$$;

revoke all on function private.mark_all_in_app_notifications_read() from public;
grant execute on function private.mark_all_in_app_notifications_read() to postgres;

alter function private.mark_all_in_app_notifications_read() owner to lean_hub_private_owner;

create or replace function public.mark_all_in_app_notifications_read()
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.mark_all_in_app_notifications_read()
$$;

revoke all on function public.mark_all_in_app_notifications_read() from public, anon;
grant execute on function public.mark_all_in_app_notifications_read() to authenticated;
