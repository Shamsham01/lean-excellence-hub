update public.profiles profile_row
set display_name = seed_row.display_name
from (
  values
    ('a0000000-0000-0000-0000-000000000001'::uuid, 'Apex Admin'),
    ('a0000000-0000-0000-0000-000000000002'::uuid, 'Apex Manager'),
    ('a0000000-0000-0000-0000-000000000003'::uuid, 'Apex Operator')
) as seed_row(user_id, display_name)
where profile_row.user_id = seed_row.user_id;
