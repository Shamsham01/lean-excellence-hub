-- PERF-LEANAI-001: covering index for leanai_semantic_events_site_fkey.
-- Do not apply to hosted Supabase without explicit rollout approval.

create index if not exists leanai_semantic_events_org_site_idx
  on public.leanai_semantic_events (organisation_id, site_unit_id);

comment on index public.leanai_semantic_events_org_site_idx is
  'Covering index for leanai_semantic_events_site_fkey (organisation_id, site_unit_id).';
