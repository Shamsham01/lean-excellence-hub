-- Switch implicit new-org timezone from UTC to Europe/London for UK product default.
-- Hosted: apply only with explicit operator approval (BST analytics skew when left at UTC).

alter table public.organisations
  alter column time_zone set default 'Europe/London';

update public.organisations
set
  time_zone = 'Europe/London',
  updated_at = statement_timestamp()
where time_zone = 'UTC';
