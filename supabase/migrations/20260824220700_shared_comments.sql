create table public.comments (
  id uuid primary key,
  organisation_id uuid not null,
  target_resource_id uuid not null,
  author_membership_id uuid not null,
  body text not null,
  created_at timestamptz not null default statement_timestamp(),
  edited_at timestamptz,
  constraint comments_organisation_id_id_key unique (organisation_id, id),
  constraint comments_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint comments_target_resource_fkey
    foreign key (organisation_id, target_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint comments_author_fkey
    foreign key (organisation_id, author_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint comments_body_check
    check (body = btrim(body) and char_length(body) between 1 and 4000)
);

create index comments_target_idx
  on public.comments (organisation_id, target_resource_id, created_at desc);

alter table public.comments enable row level security;
alter table public.comments force row level security;

create or replace function private.can_access_comment_target(
  target_organisation_id uuid,
  target_comment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_resource uuid;
begin
  select comment_row.target_resource_id
  into target_resource
  from public.comments comment_row
  where comment_row.organisation_id = target_organisation_id
    and comment_row.id = target_comment_id;

  if not found then
    return false;
  end if;

  return private.can_access_resource(target_organisation_id, target_resource);
end;
$$;

create or replace function private.create_comment(
  target_resource_id uuid,
  target_body text
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
  new_comment_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'comments.create', null, null)
    or not private.can_access_resource(org_id, target_resource_id) then
    raise exception 'comment creation is not authorised'
      using errcode = '42501';
  end if;

  new_comment_id := private.register_resource_record(
    org_id,
    'comment',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.comments (
    id,
    organisation_id,
    target_resource_id,
    author_membership_id,
    body
  )
  values (
    new_comment_id,
    org_id,
    target_resource_id,
    actor_membership_id,
    target_body
  );

  return new_comment_id;
end;
$$;

create or replace function private.edit_comment(
  target_comment_id uuid,
  target_body text
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'comments.edit', null, null)
    or not private.can_access_comment_target(org_id, target_comment_id) then
    raise exception 'comment edit is not authorised'
      using errcode = '42501';
  end if;

  update public.comments comment_row
  set body = target_body,
      edited_at = statement_timestamp()
  where comment_row.organisation_id = org_id
    and comment_row.id = target_comment_id
    and comment_row.author_membership_id = actor_membership_id;

  return found;
end;
$$;

create or replace function public.create_comment(target_resource_id uuid, target_body text)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.create_comment(target_resource_id, target_body) $$;

create or replace function public.edit_comment(target_comment_id uuid, target_body text)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.edit_comment(target_comment_id, target_body) $$;

create policy comments_select
on public.comments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'comments.read', null, null)
  and private.can_access_resource(organisation_id, target_resource_id)
);

grant execute on function public.create_comment(uuid, text) to authenticated;
grant execute on function public.edit_comment(uuid, text) to authenticated;

grant select on public.comments to authenticated;
