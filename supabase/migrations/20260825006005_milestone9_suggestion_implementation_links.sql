-- Milestone 9: suggestion implementation links and actions.

create table public.suggestion_action_context (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  suggestion_id uuid not null,
  action_id uuid not null,
  purpose text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint suggestion_action_context_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_action_context_action_key unique (organisation_id, action_id),
  constraint suggestion_action_context_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id) on delete restrict,
  constraint suggestion_action_context_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id) on delete restrict,
  constraint suggestion_action_context_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id) on delete restrict
);

create table public.suggestion_implementation_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  suggestion_id uuid not null,
  implementation_resource_id uuid not null,
  implementation_role text not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint suggestion_implementation_links_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_implementation_links_unique
    unique (organisation_id, suggestion_id, implementation_resource_id, implementation_role),
  constraint suggestion_implementation_links_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id) on delete restrict,
  constraint suggestion_implementation_links_resource_fkey
    foreign key (organisation_id, implementation_resource_id)
    references public.resource_records(organisation_id, id) on delete restrict,
  constraint suggestion_implementation_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id) on delete restrict,
  constraint suggestion_implementation_links_role_check
    check (implementation_role in ('action', 'ci_project'))
);

alter table public.suggestion_action_context enable row level security;
alter table public.suggestion_action_context force row level security;
alter table public.suggestion_implementation_links enable row level security;
alter table public.suggestion_implementation_links force row level security;
revoke all on public.suggestion_action_context from public, anon, authenticated, service_role;
revoke all on public.suggestion_implementation_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.suggestion_action_context to lean_hub_private_owner;
grant select, insert, update, delete on public.suggestion_implementation_links to lean_hub_private_owner;

create policy private_owner_all_suggestion_action_context
on public.suggestion_action_context for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_suggestion_implementation_links
on public.suggestion_implementation_links for all to lean_hub_private_owner using (true) with check (true);

create policy suggestion_action_context_select
on public.suggestion_action_context for select to authenticated
using (organisation_id = private.current_organisation_id()
  and private.can_read_improvement_suggestion(organisation_id, suggestion_id));

create policy suggestion_implementation_links_select
on public.suggestion_implementation_links for select to authenticated
using (organisation_id = private.current_organisation_id()
  and private.can_read_improvement_suggestion(organisation_id, suggestion_id));

create or replace function private.create_suggestion_action(
  target_suggestion_id uuid,
  target_title text,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_purpose text default null
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  new_action_id uuid;
begin
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion action creation is not authorised' using errcode = '42501';
  end if;
  select suggestion_table.* into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id;
  if suggestion_row.status not in ('accepted', 'implementing') then
    raise exception 'suggestion is not eligible for action creation' using errcode = '55000';
  end if;
  new_action_id := private.create_action(
    target_title, target_description, target_priority,
    suggestion_row.review_jurisdiction_unit_id, target_suggestion_id, target_due_at, null
  );
  insert into public.suggestion_action_context (
    organisation_id, suggestion_id, action_id, purpose, created_by_membership_id
  ) values (org_id, target_suggestion_id, new_action_id, target_purpose, actor_membership_id);
  insert into public.suggestion_implementation_links (
    organisation_id, suggestion_id, implementation_resource_id, implementation_role, created_by_membership_id
  ) values (org_id, target_suggestion_id, new_action_id, 'action', actor_membership_id);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionActionLinked', new_action_id::text, '{}'::jsonb);
  return new_action_id;
end; $$;

create or replace function public.create_suggestion_action(
  target_suggestion_id uuid, target_title text, target_description text default null,
  target_priority text default 'normal', target_due_at timestamptz default null, target_purpose text default null
) returns uuid language sql volatile security definer set search_path = ''
as $$ select private.create_suggestion_action(
  target_suggestion_id, target_title, target_description, target_priority, target_due_at, target_purpose) $$;

grant execute on function public.create_suggestion_action(uuid, text, text, text, timestamptz, text) to authenticated;
alter function private.create_suggestion_action(uuid, text, text, text, timestamptz, text) owner to lean_hub_private_owner;
