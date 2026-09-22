import "server-only";

import { cache } from "react";

type PermissionResolutionStore = Map<string, boolean>;

let vitestPermissionStore: PermissionResolutionStore | undefined;

const getCachedPermissionStore = cache(
  async (): Promise<PermissionResolutionStore> => new Map<string, boolean>(),
);

export async function getPermissionResolutionStore(): Promise<PermissionResolutionStore> {
  if (process.env.VITEST) {
    vitestPermissionStore ??= new Map<string, boolean>();
    return vitestPermissionStore;
  }

  return getCachedPermissionStore();
}

/** @internal Resets Vitest-only in-memory permission resolution state. */
export function resetPermissionResolutionStoreForTests(): void {
  vitestPermissionStore = undefined;
}
