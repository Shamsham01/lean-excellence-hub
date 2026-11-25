begin;
select plan(14);
select ok(c.relrowsecurity and c.relforcerowsecurity, 'Gemba action evidence enforces RLS') from pg_class c where c.oid='public.gemba_action_evidence'::regclass;
select ok(not has_table_privilege('authenticated','public.gemba_action_evidence','INSERT'),'clients cannot forge action evidence links');
select ok(not has_function_privilege('anon','public.remove_gemba_definition(uuid)','EXECUTE'),'anonymous users cannot remove definitions');
select ok(not has_function_privilege('anon','public.save_gemba_prompt_capture(uuid,uuid,text,boolean,text,boolean)','EXECUTE'),'anonymous users cannot capture observations');
select ok(not has_function_privilege('anon','private.capture_gemba_action_evidence()','EXECUTE'),'attachment trigger is private');
select ok(not has_function_privilege('anon','private.enqueue_schedule_calendar_confirmation()','EXECUTE'),'confirmation trigger is private');
select ok(not has_function_privilege('anon','private.schedule_calendar_state(public.schedule_definitions)','EXECUTE'),'schedule snapshot is private');
-- Build the walk and its two photos in the same organisation. Only one photo
-- is inherited by the action. The reader has exactly two permission grants.
create temporary table evidence_fixture (
  org uuid, reader uuid, linked uuid, unlinked uuid, action_id uuid,
  linked_path text, unlinked_path text
) on commit drop;
grant select on evidence_fixture to authenticated;

do $fixture$
declare
  owner_user uuid := gen_random_uuid();
  reader_user uuid := gen_random_uuid();
  owner_session uuid := gen_random_uuid();
  reader_session uuid := gen_random_uuid();
  org uuid; owner_member uuid; reader_member uuid; reader_role uuid; reader_version uuid;
  unit_id uuid; definition uuid; version_id uuid; section_id uuid; walk uuid;
  action_id uuid; linked record; unlinked record;
begin
  insert into auth.users (id,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
  select id,email,now(),now(),now(),'{"provider":"email","providers":["email"]}','{}',false,false
  from (values (owner_user,'427-owner@example.test'),(reader_user,'427-reader@example.test')) u(id,email);
  org := private.provision_organisation(owner_user,'gemba-evidence-427','Gemba evidence fixture');
  select id into strict owner_member from public.organisation_memberships where organisation_id=org and user_id=owner_user;
  insert into public.organisation_memberships (organisation_id,user_id,status,activated_at)
    values (org,reader_user,'active',now()) returning id into reader_member;
  update private.identity_controls set status='active', enrolment_status='complete', enrolment_completed_at=now()
    where user_id=reader_user;
  insert into auth.sessions (id,user_id,created_at,updated_at)
    values (owner_session,owner_user,now(),now()),(reader_session,reader_user,now(),now());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_user,'role','authenticated','session_id',owner_session,'email','427-owner@example.test')::text,true);
  perform public.switch_organisation(org);
  insert into public.roles (organisation_id,canonical_name,display_name,description,status,is_owner_role,is_protected)
    values (org,'evidence-reader','Evidence reader','Action evidence access','active',false,false) returning id into reader_role;
  insert into public.role_versions (organisation_id,role_id,version_number,status,created_by_membership_id)
    values (org,reader_role,1,'draft',owner_member) returning id into reader_version;
  insert into public.role_permissions (organisation_id,role_version_id,permission_key)
    values (org,reader_version,'actions.read'), (org,reader_version,'attachments.read');
  update public.role_versions set status='published',published_at=now(),published_by_membership_id=owner_member where id=reader_version;
  perform private.ensure_role_grant_scope_policies(org,reader_role,array['organisation']);
  perform public.grant_role_version(org,reader_member,reader_version,'organisation',null);
  perform public.create_organisation_unit(org,null,'gemba-site','Gemba Site','site');
  select id into strict unit_id from public.organisation_units where organisation_id=org and code='gemba-site';
  definition := public.create_gemba_definition_draft('Evidence walk',null,null,array[unit_id]);
  select v.id into strict version_id from public.gemba_definition_versions v where v.definition_id=definition;
  section_id := public.add_gemba_section(version_id,'Floor',1);
  perform public.add_gemba_question(version_id,section_id,'short_text','What did you see?',1);
  perform public.publish_gemba_definition_version(version_id);
  walk := public.start_gemba_walk(definition,unit_id);
  action_id := public.create_action('Review photo');
  select * into strict linked from public.initiate_attachment_upload(walk,'linked.jpg','image/jpeg',128);
  select * into strict unlinked from public.initiate_attachment_upload(walk,'unlinked.jpg','image/jpeg',128);
  perform public.confirm_attachment_upload(linked.attachment_id);
  perform public.confirm_attachment_upload(unlinked.attachment_id);
  insert into public.gemba_action_evidence values (org,action_id,linked.attachment_id);
  insert into storage.objects (bucket_id,name)
    values ('organisation-evidence',linked.storage_object_path),('organisation-evidence',unlinked.storage_object_path);
  insert into evidence_fixture values (org,reader_member,linked.attachment_id,unlinked.attachment_id,action_id,linked.storage_object_path,unlinked.storage_object_path);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reader_user,'role','authenticated','session_id',reader_session,'email','427-reader@example.test')::text,true);
  perform public.switch_organisation(org);
end;
$fixture$;

set local role authenticated;
select ok(private.can_read_action(org,action_id) and private.has_scoped_permission(org,'attachments.read',null,null)
  and not private.has_scoped_permission(org,'gemba.read',null,null),'reader has action and attachment access without Gemba read') from evidence_fixture;
select is((select count(*) from public.gemba_action_evidence l join evidence_fixture f on l.action_id=f.action_id),1::bigint,'reader can resolve the inherited link');
select is((select count(*) from public.attachments a join evidence_fixture f on a.id=f.linked),1::bigint,'reader can read linked attachment');
select is((select count(*) from public.attachments a join evidence_fixture f on a.id=f.unlinked),0::bigint,'reader cannot read unrelated walk attachment');
select is((select count(*) from storage.objects o join evidence_fixture f on o.name=f.linked_path),1::bigint,'reader can download linked photo');
select is((select count(*) from storage.objects o join evidence_fixture f on o.name=f.unlinked_path),0::bigint,'reader cannot download unrelated walk photo');
select ok(not has_function_privilege('anon','private.can_read_gemba_action_evidence(uuid,uuid)','execute'),'anonymous users cannot invoke inherited evidence helper');
reset role;
select * from finish();
rollback;
