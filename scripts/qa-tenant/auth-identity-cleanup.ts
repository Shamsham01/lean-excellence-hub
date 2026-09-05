import { runSupabaseDbQuery } from "./db-cli";

function formatUserIdList(userIds: readonly string[]) {
  if (userIds.length === 0) {
    return "";
  }

  return userIds.map((userId) => `'${userId}'::uuid`).join(", ");
}

export function purgeAuthUserIdentityPrerequisites(
  databaseUrl: string,
  userIds: readonly string[],
) {
  if (userIds.length === 0) {
    return;
  }

  const userIdList = formatUserIdList(userIds);
  const statements = [
    `delete from private.session_organisation_contexts where user_id in (${userIdList});`,
    `delete from public.organisation_memberships where user_id in (${userIdList});`,
    `delete from public.security_audit_events where actor_user_id in (${userIdList});`,
    `delete from public.workforce_provision_intents where created_auth_user_id in (${userIdList});`,
    `delete from private.workforce_aliases where user_id in (${userIdList});`,
    `delete from private.workforce_accounts where user_id in (${userIdList});`,
    `delete from private.identity_controls where user_id in (${userIdList});`,
    `delete from public.profiles where user_id in (${userIdList});`,
  ];

  for (const sql of statements) {
    runSupabaseDbQuery({ databaseUrl, sql });
  }
}
