-- Milestone 10: benefit portfolio and workspace query RPCs.

create or replace function private.get_benefit_fiscal_ytd_start(
  target_fiscal_year_start_month smallint,
  target_as_of_date date
)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(
    case
      when extract(month from target_as_of_date)::int >= target_fiscal_year_start_month
        then extract(year from target_as_of_date)::int
      else extract(year from target_as_of_date)::int - 1
    end,
    target_fiscal_year_start_month,
    1
  )
$$;

create or replace function private.get_benefit_reporting_fiscal_year_start_month(
  target_organisation_id uuid
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select settings_row.fiscal_year_start_month
      from public.benefit_reporting_settings settings_row
      where settings_row.organisation_id = target_organisation_id
    ),
    1::smallint
  )
$$;

create or replace function public.get_benefits_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  fiscal_year_start_month smallint;
  fiscal_ytd_start date;
  as_of_date date := statement_timestamp()::date;
  result jsonb;
begin
  if org_id is null then
    raise exception 'benefits overview is not authorised'
      using errcode = '42501';
  end if;

  fiscal_year_start_month := private.get_benefit_reporting_fiscal_year_start_month(org_id);
  fiscal_ytd_start := private.get_benefit_fiscal_ytd_start(fiscal_year_start_month, as_of_date);

  select jsonb_build_object(
    'fiscal_year_start_month', fiscal_year_start_month,
    'fiscal_ytd_start', fiscal_ytd_start,
    'as_of_date', as_of_date,
    'status_pipeline', jsonb_build_object(
      'draft', count(*) filter (where benefit_row.status = 'draft'),
      'submitted', count(*) filter (where benefit_row.status = 'submitted'),
      'approved', count(*) filter (where benefit_row.status = 'approved'),
      'realising', count(*) filter (where benefit_row.status = 'realising'),
      'realised', count(*) filter (where benefit_row.status = 'realised'),
      'rejected', count(*) filter (where benefit_row.status = 'rejected'),
      'withdrawn', count(*) filter (where benefit_row.status = 'withdrawn'),
      'cancelled', count(*) filter (where benefit_row.status = 'cancelled')
    ),
    'awaiting_validation', jsonb_build_object(
      'benefits', count(*) filter (where benefit_row.status = 'submitted'),
      'realisation_entries', (
        select count(*)
        from public.benefit_realisation_entries entry_row
        join public.improvement_benefits entry_benefit
          on entry_benefit.organisation_id = entry_row.organisation_id
         and entry_benefit.id = entry_row.benefit_id
        where entry_row.organisation_id = org_id
          and entry_row.status = 'submitted'
          and private.can_read_improvement_benefit(org_id, entry_row.benefit_id)
      )
    ),
    'financial_by_type', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'financial_type', financial_type_row.financial_type,
            'benefit_count', financial_type_row.benefit_count,
            'approved_forecast_total', financial_type_row.approved_forecast_total,
            'validated_realised_ytd', financial_type_row.validated_realised_ytd,
            'validated_realised_lifetime', financial_type_row.validated_realised_lifetime
          )
          order by financial_type_row.financial_type
        )
        from (
          select
            benefit_row.financial_type,
            count(*) as benefit_count,
            coalesce(
              sum(
                coalesce(forecast_row.forecast_total_amount, 0::numeric)
                * (
                  private.get_benefit_portfolio_allocation_percentage(org_id, benefit_row.id)
                  / 100::numeric
                )
              ),
              0::numeric
            ) as approved_forecast_total,
            coalesce(
              sum(
                (
                  select coalesce(sum(entry_row.financial_amount), 0::numeric)
                  from public.benefit_realisation_entries entry_row
                  where entry_row.organisation_id = org_id
                    and entry_row.benefit_id = benefit_row.id
                    and entry_row.status = 'validated'
                    and entry_row.period_end >= fiscal_ytd_start
                    and entry_row.period_end <= as_of_date
                )
                * (
                  private.get_benefit_portfolio_allocation_percentage(org_id, benefit_row.id)
                  / 100::numeric
                )
              ),
              0::numeric
            ) as validated_realised_ytd,
            coalesce(
              sum(
                private.get_benefit_validated_realised_total(benefit_row.id)
                * (
                  private.get_benefit_portfolio_allocation_percentage(org_id, benefit_row.id)
                  / 100::numeric
                )
              ),
              0::numeric
            ) as validated_realised_lifetime
          from public.improvement_benefits benefit_row
          left join public.benefit_forecast_versions forecast_row
            on forecast_row.organisation_id = benefit_row.organisation_id
           and forecast_row.id = benefit_row.current_forecast_version_id
           and forecast_row.lifecycle = 'approved'
          where benefit_row.organisation_id = org_id
            and benefit_row.benefit_class = 'financial'
            and benefit_row.financial_type is not null
            and private.can_read_improvement_benefit(org_id, benefit_row.id)
          group by benefit_row.financial_type
        ) financial_type_row
      ),
      '[]'::jsonb
    ),
    'non_financial', jsonb_build_object(
      'benefit_count', count(*) filter (where benefit_row.benefit_class = 'non_financial'),
      'realising_or_realised', count(*) filter (
        where benefit_row.benefit_class = 'non_financial'
          and benefit_row.status in ('realising', 'realised')
      )
    )
  )
  into result
  from public.improvement_benefits benefit_row
  where benefit_row.organisation_id = org_id
    and private.can_read_improvement_benefit(org_id, benefit_row.id);

  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.get_benefits_list(
  target_search text default null,
  target_status text default null,
  target_benefit_class text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_unit_id uuid default null,
  target_category_id uuid default null,
  target_owner_membership_id uuid default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_val integer;
  items jsonb;
  total_count integer;
begin
  if org_id is null then
    raise exception 'benefits list is not authorised'
      using errcode = '42501';
  end if;

  offset_val := greatest((target_page - 1) * target_page_size, 0);

  select count(*)
  into total_count
  from public.improvement_benefits benefit_row
  where benefit_row.organisation_id = org_id
    and private.can_read_improvement_benefit(org_id, benefit_row.id)
    and (target_status is null or benefit_row.status = target_status)
    and (target_benefit_class is null or benefit_row.benefit_class = target_benefit_class)
    and (target_financial_type is null or benefit_row.financial_type = target_financial_type)
    and (target_non_financial_type is null or benefit_row.non_financial_type = target_non_financial_type)
    and (target_unit_id is null or benefit_row.organisational_unit_id = target_unit_id)
    and (target_category_id is null or benefit_row.category_id = target_category_id)
    and (target_owner_membership_id is null or benefit_row.owner_membership_id = target_owner_membership_id)
    and (
      target_search is null
      or benefit_row.title ilike '%' || target_search || '%'
      or benefit_row.benefit_number ilike '%' || target_search || '%'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', benefit_row.id,
        'benefit_number', benefit_row.benefit_number,
        'title', benefit_row.title,
        'status', benefit_row.status,
        'benefit_class', benefit_row.benefit_class,
        'financial_type', benefit_row.financial_type,
        'non_financial_type', benefit_row.non_financial_type,
        'category_id', benefit_row.category_id,
        'organisational_unit_id', benefit_row.organisational_unit_id,
        'owner_membership_id', benefit_row.owner_membership_id,
        'reporting_currency_snapshot', benefit_row.reporting_currency_snapshot,
        'planned_realisation_start', benefit_row.planned_realisation_start,
        'planned_realisation_end', benefit_row.planned_realisation_end,
        'current_forecast_version_id', benefit_row.current_forecast_version_id,
        'forecast_total_amount', forecast_row.forecast_total_amount,
        'forecast_lifecycle', forecast_row.lifecycle,
        'validated_realised_total', case
          when benefit_row.benefit_class = 'financial'
            then private.get_benefit_validated_realised_total(benefit_row.id)
          else null
        end,
        'portfolio_allocation_percentage', private.get_benefit_portfolio_allocation_percentage(
          org_id,
          benefit_row.id
        ),
        'created_at', benefit_row.created_at,
        'updated_at', benefit_row.updated_at
      )
      order by benefit_row.updated_at desc
    ),
    '[]'::jsonb
  )
  into items
  from public.improvement_benefits benefit_row
  left join public.benefit_forecast_versions forecast_row
    on forecast_row.organisation_id = benefit_row.organisation_id
   and forecast_row.id = benefit_row.current_forecast_version_id
  where benefit_row.organisation_id = org_id
    and private.can_read_improvement_benefit(org_id, benefit_row.id)
    and (target_status is null or benefit_row.status = target_status)
    and (target_benefit_class is null or benefit_row.benefit_class = target_benefit_class)
    and (target_financial_type is null or benefit_row.financial_type = target_financial_type)
    and (target_non_financial_type is null or benefit_row.non_financial_type = target_non_financial_type)
    and (target_unit_id is null or benefit_row.organisational_unit_id = target_unit_id)
    and (target_category_id is null or benefit_row.category_id = target_category_id)
    and (target_owner_membership_id is null or benefit_row.owner_membership_id = target_owner_membership_id)
    and (
      target_search is null
      or benefit_row.title ilike '%' || target_search || '%'
      or benefit_row.benefit_number ilike '%' || target_search || '%'
    )
  limit target_page_size
  offset offset_val;

  return jsonb_build_object(
    'items', items,
    'total_count', total_count,
    'page', target_page,
    'page_size', target_page_size
  );
end;
$$;

create or replace function public.get_benefit_detail(
  target_benefit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  benefit_row public.improvement_benefits%rowtype;
  category_row public.benefit_categories%rowtype;
  unit_row public.organisation_units%rowtype;
  status_history jsonb;
  source_links jsonb;
  submission_snapshots jsonb;
  validation_assignments jsonb;
  validations jsonb;
  forecast_versions jsonb;
  current_forecast jsonb;
  current_forecast_periods jsonb;
  overlap_allocation jsonb;
  validated_realised_total numeric;
begin
  if org_id is null then
    raise exception 'benefit detail is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_improvement_benefit(org_id, target_benefit_id) then
    raise exception 'benefit detail is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit not found'
      using errcode = 'P0002';
  end if;

  if benefit_row.category_id is not null then
    select category_table.*
    into category_row
    from public.benefit_categories category_table
    where category_table.organisation_id = org_id
      and category_table.id = benefit_row.category_id;
  end if;

  select unit_table.*
  into unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = benefit_row.organisational_unit_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', history_row.id,
        'from_status', history_row.from_status,
        'to_status', history_row.to_status,
        'changed_by_membership_id', history_row.changed_by_membership_id,
        'reason', history_row.reason,
        'changed_at', history_row.changed_at
      )
      order by history_row.changed_at
    ),
    '[]'::jsonb
  )
  into status_history
  from public.benefit_status_history history_row
  where history_row.organisation_id = org_id
    and history_row.benefit_id = target_benefit_id;

  source_links := private.build_benefit_source_links_summary(org_id, target_benefit_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', snapshot_row.id,
        'benefit_number', snapshot_row.benefit_number,
        'title', snapshot_row.title,
        'submitted_at', snapshot_row.submitted_at,
        'submitted_by_membership_id', snapshot_row.submitted_by_membership_id,
        'forecast_version_id', snapshot_row.forecast_version_id,
        'forecast_total_amount', snapshot_row.forecast_total_amount
      )
      order by snapshot_row.submitted_at desc
    ),
    '[]'::jsonb
  )
  into submission_snapshots
  from public.benefit_submission_snapshots snapshot_row
  where snapshot_row.organisation_id = org_id
    and snapshot_row.benefit_id = target_benefit_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', assignment_row.id,
        'validator_membership_id', assignment_row.validator_membership_id,
        'validation_role', assignment_row.validation_role,
        'status', assignment_row.status,
        'assigned_at', assignment_row.assigned_at,
        'assigned_by_membership_id', assignment_row.assigned_by_membership_id,
        'completed_at', assignment_row.completed_at
      )
      order by assignment_row.assigned_at
    ),
    '[]'::jsonb
  )
  into validation_assignments
  from public.benefit_validation_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.benefit_id = target_benefit_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', validation_row.id,
        'submission_snapshot_id', validation_row.submission_snapshot_id,
        'forecast_version_id', validation_row.forecast_version_id,
        'validator_membership_id', validation_row.validator_membership_id,
        'validation_role', validation_row.validation_role,
        'decision', validation_row.decision,
        'rationale', validation_row.rationale,
        'created_at', validation_row.created_at
      )
      order by validation_row.created_at
    ),
    '[]'::jsonb
  )
  into validations
  from public.benefit_validations validation_row
  where validation_row.organisation_id = org_id
    and validation_row.benefit_id = target_benefit_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', version_row.id,
        'version_number', version_row.version_number,
        'lifecycle', version_row.lifecycle,
        'realisation_pattern', version_row.realisation_pattern,
        'forecast_start_date', version_row.forecast_start_date,
        'forecast_end_date', version_row.forecast_end_date,
        'forecast_total_amount', version_row.forecast_total_amount,
        'target_measure_value', version_row.target_measure_value,
        'target_measure_unit', version_row.target_measure_unit,
        'target_date', version_row.target_date,
        'created_at', version_row.created_at,
        'submitted_at', version_row.submitted_at,
        'approved_at', version_row.approved_at
      )
      order by version_row.version_number desc
    ),
    '[]'::jsonb
  )
  into forecast_versions
  from public.benefit_forecast_versions version_row
  where version_row.organisation_id = org_id
    and version_row.benefit_id = target_benefit_id;

  if benefit_row.current_forecast_version_id is not null then
    select jsonb_build_object(
      'id', version_row.id,
      'version_number', version_row.version_number,
      'lifecycle', version_row.lifecycle,
      'realisation_pattern', version_row.realisation_pattern,
      'forecast_start_date', version_row.forecast_start_date,
      'forecast_end_date', version_row.forecast_end_date,
      'forecast_total_amount', version_row.forecast_total_amount,
      'calculation_basis', version_row.calculation_basis,
      'assumptions', version_row.assumptions,
      'target_measure_value', version_row.target_measure_value,
      'target_measure_unit', version_row.target_measure_unit,
      'target_date', version_row.target_date,
      'created_at', version_row.created_at,
      'submitted_at', version_row.submitted_at,
      'approved_at', version_row.approved_at
    )
    into current_forecast
    from public.benefit_forecast_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = benefit_row.current_forecast_version_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', period_row.id,
          'period_start', period_row.period_start,
          'period_end', period_row.period_end,
          'forecast_amount', period_row.forecast_amount,
          'display_order', period_row.display_order
        )
        order by period_row.display_order
      ),
      '[]'::jsonb
    )
    into current_forecast_periods
    from public.benefit_forecast_periods period_row
    where period_row.organisation_id = org_id
      and period_row.forecast_version_id = benefit_row.current_forecast_version_id;
  end if;

  select jsonb_build_object(
    'allocation_percentage', allocation_row.allocation_percentage,
    'overlap_group_id', allocation_row.overlap_group_id,
    'overlap_group_name', overlap_group_row.name,
    'effective_from', allocation_row.effective_from
  )
  into overlap_allocation
  from public.benefit_overlap_allocation_history allocation_row
  join public.benefit_overlap_groups overlap_group_row
    on overlap_group_row.organisation_id = allocation_row.organisation_id
   and overlap_group_row.id = allocation_row.overlap_group_id
  where allocation_row.organisation_id = org_id
    and allocation_row.benefit_id = target_benefit_id
    and allocation_row.superseded_at is null
  order by allocation_row.effective_from desc, allocation_row.id desc
  limit 1;

  if benefit_row.benefit_class = 'financial' then
    validated_realised_total := private.get_benefit_validated_realised_total(target_benefit_id);
  else
    select coalesce(sum(entry_row.measure_value), 0::numeric)
    into validated_realised_total
    from public.benefit_realisation_entries entry_row
    where entry_row.organisation_id = org_id
      and entry_row.benefit_id = target_benefit_id
      and entry_row.status = 'validated';
  end if;

  return jsonb_build_object(
    'id', benefit_row.id,
    'benefit_number', benefit_row.benefit_number,
    'title', benefit_row.title,
    'description', benefit_row.description,
    'benefit_class', benefit_row.benefit_class,
    'financial_type', benefit_row.financial_type,
    'non_financial_type', benefit_row.non_financial_type,
    'category_id', benefit_row.category_id,
    'category_code', category_row.code,
    'category_name', category_row.name,
    'organisational_unit_id', benefit_row.organisational_unit_id,
    'unit_code', unit_row.code,
    'unit_name', unit_row.name,
    'owner_membership_id', benefit_row.owner_membership_id,
    'created_by_membership_id', benefit_row.created_by_membership_id,
    'reporting_currency_snapshot', benefit_row.reporting_currency_snapshot,
    'baseline_description', benefit_row.baseline_description,
    'baseline_period_start', benefit_row.baseline_period_start,
    'baseline_period_end', benefit_row.baseline_period_end,
    'baseline_measure_value', benefit_row.baseline_measure_value,
    'baseline_measure_unit', benefit_row.baseline_measure_unit,
    'baseline_financial_value', benefit_row.baseline_financial_value,
    'planned_realisation_start', benefit_row.planned_realisation_start,
    'planned_realisation_end', benefit_row.planned_realisation_end,
    'status', benefit_row.status,
    'is_standalone_initiative', benefit_row.is_standalone_initiative,
    'current_forecast_version_id', benefit_row.current_forecast_version_id,
    'portfolio_allocation_percentage', private.get_benefit_portfolio_allocation_percentage(
      org_id,
      target_benefit_id
    ),
    'validated_realised_total', validated_realised_total,
    'created_at', benefit_row.created_at,
    'updated_at', benefit_row.updated_at,
    'status_history', status_history,
    'source_links', source_links,
    'submission_snapshots', submission_snapshots,
    'validation_assignments', validation_assignments,
    'validations', validations,
    'forecast_versions', forecast_versions,
    'current_forecast', current_forecast,
    'current_forecast_periods', coalesce(current_forecast_periods, '[]'::jsonb),
    'overlap_allocation', overlap_allocation
  );
end;
$$;

create or replace function public.get_benefit_validation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  benefit_items jsonb;
  realisation_items jsonb;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit validation queue is not authorised'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', benefit_row.id,
        'benefit_number', benefit_row.benefit_number,
        'title', benefit_row.title,
        'status', benefit_row.status,
        'benefit_class', benefit_row.benefit_class,
        'financial_type', benefit_row.financial_type,
        'organisational_unit_id', benefit_row.organisational_unit_id,
        'validation_role', assignment_row.validation_role,
        'assigned_at', assignment_row.assigned_at
      )
      order by assignment_row.assigned_at nulls last, benefit_row.updated_at desc
    ),
    '[]'::jsonb
  )
  into benefit_items
  from public.improvement_benefits benefit_row
  join public.benefit_validation_assignments assignment_row
    on assignment_row.organisation_id = benefit_row.organisation_id
   and assignment_row.benefit_id = benefit_row.id
  where benefit_row.organisation_id = org_id
    and benefit_row.status = 'submitted'
    and assignment_row.status = 'active'
    and assignment_row.validator_membership_id = actor_membership_id
    and private.can_read_improvement_benefit(org_id, benefit_row.id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', entry_row.id,
        'benefit_id', entry_row.benefit_id,
        'benefit_number', benefit_row.benefit_number,
        'benefit_title', benefit_row.title,
        'period_start', entry_row.period_start,
        'period_end', entry_row.period_end,
        'financial_amount', entry_row.financial_amount,
        'measure_value', entry_row.measure_value,
        'measure_unit', entry_row.measure_unit,
        'entry_kind', entry_row.entry_kind,
        'submitted_at', entry_row.submitted_at,
        'recorded_by_membership_id', entry_row.recorded_by_membership_id
      )
      order by entry_row.submitted_at nulls last, entry_row.recorded_at desc
    ),
    '[]'::jsonb
  )
  into realisation_items
  from public.benefit_realisation_entries entry_row
  join public.improvement_benefits benefit_row
    on benefit_row.organisation_id = entry_row.organisation_id
   and benefit_row.id = entry_row.benefit_id
  where entry_row.organisation_id = org_id
    and entry_row.status = 'submitted'
    and private.can_read_improvement_benefit(org_id, entry_row.benefit_id)
    and private.can_validate_benefit_realisation(
      org_id,
      benefit_row.organisational_unit_id
    );

  return jsonb_build_object(
    'benefits', benefit_items,
    'realisation_entries', realisation_items
  );
end;
$$;

create or replace function public.get_benefit_forecast_history(
  target_benefit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  items jsonb;
begin
  if org_id is null then
    raise exception 'benefit forecast history is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_improvement_benefit(org_id, target_benefit_id) then
    raise exception 'benefit forecast history is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = org_id
      and benefit_row.id = target_benefit_id
  ) then
    raise exception 'benefit not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', version_row.id,
        'version_number', version_row.version_number,
        'lifecycle', version_row.lifecycle,
        'realisation_pattern', version_row.realisation_pattern,
        'forecast_start_date', version_row.forecast_start_date,
        'forecast_end_date', version_row.forecast_end_date,
        'forecast_total_amount', version_row.forecast_total_amount,
        'calculation_basis', version_row.calculation_basis,
        'assumptions', version_row.assumptions,
        'target_measure_value', version_row.target_measure_value,
        'target_measure_unit', version_row.target_measure_unit,
        'target_date', version_row.target_date,
        'created_by_membership_id', version_row.created_by_membership_id,
        'created_at', version_row.created_at,
        'submitted_at', version_row.submitted_at,
        'approved_at', version_row.approved_at,
        'approved_by_membership_id', version_row.approved_by_membership_id,
        'periods', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', period_row.id,
                'period_start', period_row.period_start,
                'period_end', period_row.period_end,
                'forecast_amount', period_row.forecast_amount,
                'display_order', period_row.display_order
              )
              order by period_row.display_order
            )
            from public.benefit_forecast_periods period_row
            where period_row.organisation_id = org_id
              and period_row.forecast_version_id = version_row.id
          ),
          '[]'::jsonb
        )
      )
      order by version_row.version_number desc
    ),
    '[]'::jsonb
  )
  into items
  from public.benefit_forecast_versions version_row
  where version_row.organisation_id = org_id
    and version_row.benefit_id = target_benefit_id;

  return jsonb_build_object('items', items);
end;
$$;

create or replace function public.get_benefit_realisation_history(
  target_benefit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  items jsonb;
begin
  if org_id is null then
    raise exception 'benefit realisation history is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_improvement_benefit(org_id, target_benefit_id) then
    raise exception 'benefit realisation history is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = org_id
      and benefit_row.id = target_benefit_id
  ) then
    raise exception 'benefit not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', entry_row.id,
        'period_start', entry_row.period_start,
        'period_end', entry_row.period_end,
        'financial_amount', entry_row.financial_amount,
        'measure_value', entry_row.measure_value,
        'measure_unit', entry_row.measure_unit,
        'entry_kind', entry_row.entry_kind,
        'data_source', entry_row.data_source,
        'notes', entry_row.notes,
        'status', entry_row.status,
        'recorded_by_membership_id', entry_row.recorded_by_membership_id,
        'recorded_at', entry_row.recorded_at,
        'submitted_at', entry_row.submitted_at,
        'validated_by_membership_id', entry_row.validated_by_membership_id,
        'validated_at', entry_row.validated_at,
        'adjustment_of_entry_id', entry_row.adjustment_of_entry_id,
        'is_correction', entry_row.is_correction
      )
      order by entry_row.period_start, entry_row.recorded_at, entry_row.id
    ),
    '[]'::jsonb
  )
  into items
  from public.benefit_realisation_entries entry_row
  where entry_row.organisation_id = org_id
    and entry_row.benefit_id = target_benefit_id;

  return jsonb_build_object('items', items);
end;
$$;

create or replace function public.get_benefit_realisation_summary(
  target_benefit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  benefit_row public.improvement_benefits%rowtype;
  target_forecast_version_id uuid;
  forecast_lifecycle text;
  periods jsonb;
  totals jsonb;
begin
  if org_id is null then
    raise exception 'benefit realisation summary is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_improvement_benefit(org_id, target_benefit_id) then
    raise exception 'benefit realisation summary is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit not found'
      using errcode = 'P0002';
  end if;

  select version_row.id, version_row.lifecycle
  into target_forecast_version_id, forecast_lifecycle
  from public.benefit_forecast_versions version_row
  where version_row.organisation_id = org_id
    and version_row.benefit_id = target_benefit_id
    and version_row.lifecycle = 'approved'
  order by version_row.version_number desc, version_row.approved_at desc nulls last
  limit 1;

  if target_forecast_version_id is null and benefit_row.current_forecast_version_id is not null then
    select version_row.id, version_row.lifecycle
    into target_forecast_version_id, forecast_lifecycle
    from public.benefit_forecast_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = benefit_row.current_forecast_version_id;
  end if;

  if benefit_row.benefit_class = 'financial' then
    with period_rows as (
      select
        period_row.period_start,
        period_row.period_end,
        period_row.display_order,
        period_row.forecast_amount as forecast_amount,
        coalesce(
          (
            select sum(entry_row.financial_amount)
            from public.benefit_realisation_entries entry_row
            where entry_row.organisation_id = org_id
              and entry_row.benefit_id = target_benefit_id
              and entry_row.status = 'validated'
              and entry_row.period_start <= period_row.period_end
              and entry_row.period_end >= period_row.period_start
          ),
          0::numeric
        ) as validated_amount
      from public.benefit_forecast_periods period_row
      where period_row.organisation_id = org_id
        and period_row.forecast_version_id = target_forecast_version_id
    ),
    enriched_period_rows as (
      select
        period_rows.period_start,
        period_rows.period_end,
        period_rows.display_order,
        period_rows.forecast_amount,
        period_rows.validated_amount,
        (period_rows.validated_amount - period_rows.forecast_amount) as variance_amount,
        sum(period_rows.forecast_amount) over (
          order by period_rows.display_order
          rows between unbounded preceding and current row
        ) as cumulative_forecast_amount,
        sum(period_rows.validated_amount) over (
          order by period_rows.display_order
          rows between unbounded preceding and current row
        ) as cumulative_validated_amount
      from period_rows
    )
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'period_start', enriched_period_rows.period_start,
            'period_end', enriched_period_rows.period_end,
            'display_order', enriched_period_rows.display_order,
            'forecast_amount', enriched_period_rows.forecast_amount,
            'validated_amount', enriched_period_rows.validated_amount,
            'variance_amount', enriched_period_rows.variance_amount,
            'cumulative_forecast_amount', enriched_period_rows.cumulative_forecast_amount,
            'cumulative_validated_amount', enriched_period_rows.cumulative_validated_amount,
            'cumulative_variance_amount',
              enriched_period_rows.cumulative_validated_amount
              - enriched_period_rows.cumulative_forecast_amount
          )
          order by enriched_period_rows.display_order
        ),
        '[]'::jsonb
      ),
      (
        select jsonb_build_object(
          'forecast_total', coalesce(sum(enriched_period_rows.forecast_amount), 0::numeric),
          'validated_total', coalesce(sum(enriched_period_rows.validated_amount), 0::numeric),
          'variance_total',
            coalesce(sum(enriched_period_rows.validated_amount), 0::numeric)
            - coalesce(sum(enriched_period_rows.forecast_amount), 0::numeric)
        )
        from enriched_period_rows
      )
    into periods, totals
    from enriched_period_rows;
  else
    with period_rows as (
      select
        period_row.period_start,
        period_row.period_end,
        period_row.display_order,
        period_row.forecast_amount as forecast_amount,
        coalesce(
          (
            select sum(entry_row.measure_value)
            from public.benefit_realisation_entries entry_row
            where entry_row.organisation_id = org_id
              and entry_row.benefit_id = target_benefit_id
              and entry_row.status = 'validated'
              and entry_row.period_start <= period_row.period_end
              and entry_row.period_end >= period_row.period_start
          ),
          0::numeric
        ) as validated_amount
      from public.benefit_forecast_periods period_row
      where period_row.organisation_id = org_id
        and period_row.forecast_version_id = target_forecast_version_id
    ),
    enriched_period_rows as (
      select
        period_rows.period_start,
        period_rows.period_end,
        period_rows.display_order,
        period_rows.forecast_amount,
        period_rows.validated_amount,
        (period_rows.validated_amount - period_rows.forecast_amount) as variance_amount,
        sum(period_rows.forecast_amount) over (
          order by period_rows.display_order
          rows between unbounded preceding and current row
        ) as cumulative_forecast_amount,
        sum(period_rows.validated_amount) over (
          order by period_rows.display_order
          rows between unbounded preceding and current row
        ) as cumulative_validated_amount
      from period_rows
    )
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'period_start', enriched_period_rows.period_start,
            'period_end', enriched_period_rows.period_end,
            'display_order', enriched_period_rows.display_order,
            'forecast_amount', enriched_period_rows.forecast_amount,
            'validated_amount', enriched_period_rows.validated_amount,
            'variance_amount', enriched_period_rows.variance_amount,
            'cumulative_forecast_amount', enriched_period_rows.cumulative_forecast_amount,
            'cumulative_validated_amount', enriched_period_rows.cumulative_validated_amount,
            'cumulative_variance_amount',
              enriched_period_rows.cumulative_validated_amount
              - enriched_period_rows.cumulative_forecast_amount
          )
          order by enriched_period_rows.display_order
        ),
        '[]'::jsonb
      ),
      (
        select jsonb_build_object(
          'forecast_total', coalesce(sum(enriched_period_rows.forecast_amount), 0::numeric),
          'validated_total', coalesce(sum(enriched_period_rows.validated_amount), 0::numeric),
          'variance_total',
            coalesce(sum(enriched_period_rows.validated_amount), 0::numeric)
            - coalesce(sum(enriched_period_rows.forecast_amount), 0::numeric)
        )
        from enriched_period_rows
      )
    into periods, totals
    from enriched_period_rows;
  end if;

  return jsonb_build_object(
    'benefit_id', target_benefit_id,
    'benefit_class', benefit_row.benefit_class,
    'financial_type', benefit_row.financial_type,
    'non_financial_type', benefit_row.non_financial_type,
    'reporting_currency_snapshot', benefit_row.reporting_currency_snapshot,
    'forecast_version_id', target_forecast_version_id,
    'forecast_lifecycle', forecast_lifecycle,
    'portfolio_allocation_percentage', private.get_benefit_portfolio_allocation_percentage(
      org_id,
      target_benefit_id
    ),
    'periods', coalesce(periods, '[]'::jsonb),
    'totals', coalesce(
      totals,
      jsonb_build_object(
        'forecast_total', 0::numeric,
        'validated_total', 0::numeric,
        'variance_total', 0::numeric
      )
    )
  );
end;
$$;

create or replace function public.get_project_benefits(
  target_project_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  items jsonb;
begin
  if org_id is null then
    raise exception 'project benefits are not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_ci_project(org_id, target_project_id) then
    raise exception 'project benefits are not authorised'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', benefit_row.id,
        'benefit_number', benefit_row.benefit_number,
        'title', benefit_row.title,
        'status', benefit_row.status,
        'benefit_class', benefit_row.benefit_class,
        'financial_type', benefit_row.financial_type,
        'non_financial_type', benefit_row.non_financial_type,
        'relationship_role', link_row.relationship_role,
        'forecast_total_amount', forecast_row.forecast_total_amount,
        'validated_realised_total', case
          when benefit_row.benefit_class = 'financial'
            then private.get_benefit_validated_realised_total(benefit_row.id)
          else null
        end,
        'portfolio_allocation_percentage', private.get_benefit_portfolio_allocation_percentage(
          org_id,
          benefit_row.id
        ),
        'updated_at', benefit_row.updated_at
      )
      order by benefit_row.updated_at desc
    ),
    '[]'::jsonb
  )
  into items
  from public.benefit_source_links link_row
  join public.improvement_benefits benefit_row
    on benefit_row.organisation_id = link_row.organisation_id
   and benefit_row.id = link_row.benefit_id
  left join public.benefit_forecast_versions forecast_row
    on forecast_row.organisation_id = benefit_row.organisation_id
   and forecast_row.id = benefit_row.current_forecast_version_id
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_project_id
    and private.can_read_improvement_benefit(org_id, benefit_row.id);

  return jsonb_build_object('items', items);
end;
$$;

create or replace function public.get_suggestion_benefits(
  target_suggestion_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  items jsonb;
begin
  if org_id is null then
    raise exception 'suggestion benefits are not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion benefits are not authorised'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', benefit_row.id,
        'benefit_number', benefit_row.benefit_number,
        'title', benefit_row.title,
        'status', benefit_row.status,
        'benefit_class', benefit_row.benefit_class,
        'financial_type', benefit_row.financial_type,
        'non_financial_type', benefit_row.non_financial_type,
        'relationship_role', link_row.relationship_role,
        'forecast_total_amount', forecast_row.forecast_total_amount,
        'validated_realised_total', case
          when benefit_row.benefit_class = 'financial'
            then private.get_benefit_validated_realised_total(benefit_row.id)
          else null
        end,
        'portfolio_allocation_percentage', private.get_benefit_portfolio_allocation_percentage(
          org_id,
          benefit_row.id
        ),
        'updated_at', benefit_row.updated_at
      )
      order by benefit_row.updated_at desc
    ),
    '[]'::jsonb
  )
  into items
  from public.benefit_source_links link_row
  join public.improvement_benefits benefit_row
    on benefit_row.organisation_id = link_row.organisation_id
   and benefit_row.id = link_row.benefit_id
  left join public.benefit_forecast_versions forecast_row
    on forecast_row.organisation_id = benefit_row.organisation_id
   and forecast_row.id = benefit_row.current_forecast_version_id
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_suggestion_id
    and private.can_read_improvement_benefit(org_id, benefit_row.id);

  return jsonb_build_object('items', items);
end;
$$;

create or replace function public.get_potential_benefit_overlaps(
  target_benefit_id uuid
)
returns table (
  candidate_benefit_id uuid,
  candidate_benefit_number text,
  candidate_title text,
  signal_type text,
  signal_detail text
)
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from private.get_potential_benefit_overlaps(target_benefit_id)
$$;

grant execute on function public.get_benefits_overview() to authenticated;
grant execute on function public.get_benefits_list(
  text, text, text, text, text, uuid, uuid, uuid, integer, integer
) to authenticated;
grant execute on function public.get_benefit_detail(uuid) to authenticated;
grant execute on function public.get_benefit_validation_queue() to authenticated;
grant execute on function public.get_benefit_forecast_history(uuid) to authenticated;
grant execute on function public.get_benefit_realisation_history(uuid) to authenticated;
grant execute on function public.get_benefit_realisation_summary(uuid) to authenticated;
grant execute on function public.get_project_benefits(uuid) to authenticated;
grant execute on function public.get_suggestion_benefits(uuid) to authenticated;
grant execute on function public.get_potential_benefit_overlaps(uuid) to authenticated;

revoke all on function public.get_benefits_overview() from public, anon;
revoke all on function public.get_benefits_list(
  text, text, text, text, text, uuid, uuid, uuid, integer, integer
) from public, anon;
revoke all on function public.get_benefit_detail(uuid) from public, anon;
revoke all on function public.get_benefit_validation_queue() from public, anon;
revoke all on function public.get_benefit_forecast_history(uuid) from public, anon;
revoke all on function public.get_benefit_realisation_history(uuid) from public, anon;
revoke all on function public.get_benefit_realisation_summary(uuid) from public, anon;
revoke all on function public.get_project_benefits(uuid) from public, anon;
revoke all on function public.get_suggestion_benefits(uuid) from public, anon;
revoke all on function public.get_potential_benefit_overlaps(uuid) from public, anon;

revoke all on function private.get_benefit_fiscal_ytd_start(smallint, date) from public;
revoke all on function private.get_benefit_reporting_fiscal_year_start_month(uuid) from public;

grant execute on function private.get_benefit_fiscal_ytd_start(smallint, date) to lean_hub_private_owner;
grant execute on function private.get_benefit_reporting_fiscal_year_start_month(uuid) to lean_hub_private_owner;

alter function private.get_benefit_fiscal_ytd_start(smallint, date) owner to lean_hub_private_owner;
alter function private.get_benefit_reporting_fiscal_year_start_month(uuid) owner to lean_hub_private_owner;
