import type { User } from "@supabase/supabase-js";

export function isVerifiedAzureIdentity(user: User, expectedTenantId: string) {
  const azureIdentity = user.identities?.find(
    (identity) => identity.provider === "azure",
  );
  const identityData = azureIdentity?.identity_data;
  const verifiedEmail =
    identityData?.xms_edov === true || identityData?.xms_edov === "true";

  return Boolean(
    azureIdentity &&
    verifiedEmail &&
    typeof identityData?.email === "string" &&
    identityData.email.toLowerCase() === user.email?.toLowerCase() &&
    identityData?.tid === expectedTenantId,
  );
}
