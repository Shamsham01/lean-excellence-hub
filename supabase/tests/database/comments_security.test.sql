begin;

select plan(5);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '91000000-0000-0000-0000-000000000001',
    'comment-owner-a@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'comment-owner-b@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table comment_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on comment_ids to authenticated;

insert into comment_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '91000000-0000-0000-0000-000000000001',
      'comment-tenant-a',
      'Comment Tenant A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '91000000-0000-0000-0000-000000000002',
      'comment-tenant-b',
      'Comment Tenant B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

set local role authenticated;

select is(
  (select count(*) from public.comments),
  0::bigint,
  'comments are default-deny without organisation context'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000001","email":"comment-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from comment_ids where key = 'org_a')),
  'tenant A owner selects organisation'
);

insert into comment_ids (key, id)
select 'action', public.create_action('Comment target action');

insert into comment_ids (key, id)
select 'comment', public.create_comment(
  (select id from comment_ids where key = 'action'),
  'Visible follow-up'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000002","email":"comment-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from comment_ids where key = 'org_b')),
  'tenant B owner selects organisation'
);

select is(
  (select count(*) from public.comments),
  0::bigint,
  'tenant B cannot read tenant A comments'
);

select throws_ok(
  format(
    $query$
      select public.create_comment(
        %L::uuid,
        'Cross-tenant comment'
      )
    $query$,
    (select id from comment_ids where key = 'action')
  ),
  '42501',
  null,
  'cross-tenant comment targets are rejected'
);

reset role;

select * from finish();
rollback;
