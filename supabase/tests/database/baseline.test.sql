begin;

select plan(2);

select has_schema('public', 'the public schema is available');
select has_extension('pgtap', 'the pgTAP extension is available');

select * from finish();

rollback;
