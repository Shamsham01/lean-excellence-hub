
### Protected ci_projects columns

Since #421, changes to status, lifecycle dates, charter submission, methodology
version, identity and scope columns, and `updated_at` require the
`lean_hub_private_owner` role. For repairs through `postgres`, dashboard SQL,
MCP `execute_sql`, or a repair migration, use
`set local role lean_hub_private_owner;` in the same transaction as the update.

Postgres runs BEFORE UPDATE triggers in name order.
`ci_projects_guard_lifecycle_columns` runs before both
`ci_projects_set_site_unit_id` and `ci_projects_touch_updated_at`.
Any future BEFORE UPDATE trigger that sorts before the guard must leave the
protected columns alone.
