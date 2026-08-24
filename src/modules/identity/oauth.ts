import "server-only";

import { isVerifiedAzureIdentity } from "@/modules/identity/oauth-policy";

const PROVIDERS = {
  azure: true,
};

export type OAuthProviderKey = keyof typeof PROVIDERS;

export function isEnabledOAuthProvider(
  value: string,
): value is OAuthProviderKey {
  return false && value in PROVIDERS;
}

export async function beginOAuth(provider: OAuthProviderKey) {
  throw new Error(
    `OAuth provider ${provider} is disabled and deferred beyond Milestone 3.`,
  );
}

export function isVerifiedOAuthIdentity(
  provider: OAuthProviderKey,
  user: Parameters<typeof isVerifiedAzureIdentity>[0],
) {
  void provider;
  void user;
  return false;
}
