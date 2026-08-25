-- M5 fix: template engine tables were created after the initial private_owner_all
-- bootstrap and need explicit grants for SECURITY DEFINER functions owned by
-- lean_hub_private_owner.

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'templates',
    'template_versions',
    'template_sections',
    'template_questions',
    'template_submissions',
    'template_answers',
    'template_answer_people'
  ]
  loop
    execute format(
      'grant select, insert, update, delete on public.%I to lean_hub_private_owner',
      relation_name
    );

    if not exists (
      select 1
      from pg_policies policy_row
      where policy_row.schemaname = 'public'
        and policy_row.tablename = relation_name
        and policy_row.policyname = format('private_owner_all_%s', relation_name)
    ) then
      execute format(
        'create policy private_owner_all_%I on public.%I for all to lean_hub_private_owner using (true) with check (true)',
        relation_name,
        relation_name
      );
    end if;
  end loop;
end
$$;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.create_template_draft(text,text)'::regprocedure,
    'private.publish_template_version(uuid)'::regprocedure,
    'private.create_template_submission(uuid)'::regprocedure,
    'private.complete_template_submission(uuid)'::regprocedure,
    'private.can_read_template_submission(uuid,uuid)'::regprocedure,
    'private.guard_published_template_version()'::regprocedure,
    'private.guard_completed_submission()'::regprocedure
  ]
  loop
    execute format('alter function %s owner to lean_hub_private_owner', function_signature);
  end loop;
end
$$;
