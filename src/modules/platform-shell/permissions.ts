import "server-only";

import { cache } from "react";
import { unstable_rethrow } from "next/navigation";

import {
  PlatformBoundaryError,
  throwPlatformBoundaryError,
} from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import {
  classifyPermissionProbeResult,
  readSupabaseErrorFields,
  type PermissionProbeClassification,
} from "@/platform/supabase/error-classification";
import {
  getPermissionResolutionStore,
  type PermissionResolutionStore,
} from "@/modules/platform-shell/permission-resolution-store";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function rethrowProbeControlErrors(error: unknown): void {
  unstable_rethrow(error);
  if (error instanceof PlatformBoundaryError) {
    throw error;
  }
}

async function throwAuthProbeFailure(
  operation: string,
  permissionKey: string,
  error: unknown,
): Promise<never> {
  const { code, message } = readSupabaseErrorFields(error);
  throwPlatformBoundaryError({
    category: "auth",
    operation,
    route: await readRequestPathname(),
    supabaseError: { code, message },
    cause: error,
  });
}

async function throwPermissionProbeFailure(
  operation: string,
  permissionKey: string,
  error: unknown,
): Promise<never> {
  const { code, message } = readSupabaseErrorFields(error);
  throwPlatformBoundaryError({
    category: "organisation_access",
    operation,
    route: await readRequestPathname(),
    supabaseError: { code, message },
    cause: error,
  });
}

async function throwClassifiedProbeFailure(
  classified: Exclude<PermissionProbeClassification<unknown>, { ok: true }>,
  operation: string,
  permissionKey: string,
): Promise<never> {
  switch (classified.outcome) {
    case "auth_failure":
      return throwAuthProbeFailure(operation, permissionKey, classified.error);
    case "infrastructure":
      return throwPermissionProbeFailure(
        operation,
        permissionKey,
        classified.error,
      );
    case "denied":
    case "not_found":
      throw new Error(
        `Unexpected permission probe outcome "${classified.outcome}" for ${operation}.`,
      );
  }
}

async function probeSingleMemberPermission(
  permissionKey: string,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("member_has_permission", {
    target_permission_key: permissionKey,
  });
  const classified = classifyPermissionProbeResult(result);
  if (!classified.ok) {
    if (classified.outcome === "denied" || classified.outcome === "not_found") {
      return false;
    }

    return throwClassifiedProbeFailure(
      classified,
      "member_has_permission",
      permissionKey,
    );
  }

  return classified.data === true;
}

async function throwMalformedBatchPermissionPayload(
  permissionKeys: string[],
  detail: string,
): Promise<never> {
  return throwPermissionProbeFailure(
    "member_has_permissions",
    permissionKeys.join(","),
    new Error(`Malformed member_has_permissions payload: ${detail}`),
  );
}

async function parseBatchMemberPermissionPayload(
  permissionKeys: string[],
  data: unknown,
): Promise<Record<string, boolean>> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return throwMalformedBatchPermissionPayload(
      permissionKeys,
      "expected jsonb object",
    );
  }

  const payload = data as Record<string, unknown>;
  const resolved: Record<string, boolean> = {};

  for (const permissionKey of permissionKeys) {
    if (!(permissionKey in payload)) {
      return throwMalformedBatchPermissionPayload(
        permissionKeys,
        `missing key "${permissionKey}"`,
      );
    }

    const value = payload[permissionKey];
    if (value === true) {
      resolved[permissionKey] = true;
      continue;
    }

    if (value === false) {
      resolved[permissionKey] = false;
      continue;
    }

    return throwMalformedBatchPermissionPayload(
      permissionKeys,
      `non-boolean value for "${permissionKey}"`,
    );
  }

  return resolved;
}

async function probeBatchMemberPermissions(
  permissionKeys: string[],
): Promise<Record<string, boolean>> {
  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("member_has_permissions", {
    target_permission_keys: permissionKeys,
  });
  const classified = classifyPermissionProbeResult(result);
  if (!classified.ok) {
    if (classified.outcome === "denied" || classified.outcome === "not_found") {
      return Object.fromEntries(permissionKeys.map((key) => [key, false]));
    }

    return throwClassifiedProbeFailure(
      classified,
      "member_has_permissions",
      permissionKeys.join(","),
    );
  }

  return parseBatchMemberPermissionPayload(permissionKeys, classified.data);
}

function writeResolvedPermissions(
  store: PermissionResolutionStore,
  resolved: Record<string, boolean>,
): void {
  for (const [permissionKey, granted] of Object.entries(resolved)) {
    store.set(permissionKey, granted === true);
  }
}

async function resolveMemberPermissionsIntoStore(
  store: PermissionResolutionStore,
  permissionKeys: string[],
): Promise<void> {
  const uncachedKeys = permissionKeys.filter(
    (permissionKey) => !store.has(permissionKey),
  );

  if (uncachedKeys.length === 0) {
    return;
  }

  try {
    const [singlePermissionKey] = uncachedKeys;
    const resolved =
      uncachedKeys.length === 1 && singlePermissionKey
        ? {
            [singlePermissionKey]:
              await probeSingleMemberPermission(singlePermissionKey),
          }
        : await probeBatchMemberPermissions(uncachedKeys);

    writeResolvedPermissions(store, resolved);
  } catch (error) {
    rethrowProbeControlErrors(error);
    return throwPermissionProbeFailure(
      uncachedKeys.length === 1
        ? "member_has_permission"
        : "member_has_permissions",
      uncachedKeys.join(","),
      error,
    );
  }
}

export async function prefetchMemberPermissions(
  permissionKeys: string[],
): Promise<void> {
  const store = await getPermissionResolutionStore();
  await resolveMemberPermissionsIntoStore(store, permissionKeys);
}

export const currentMemberHasPermission = cache(
  async (permissionKey: string) => {
    const store = await getPermissionResolutionStore();
    const cached = store.get(permissionKey);
    if (cached !== undefined) {
      return cached;
    }

    await resolveMemberPermissionsIntoStore(store, [permissionKey]);
    return store.get(permissionKey) ?? false;
  },
);

export const currentMemberHasScopedPermission = cache(
  async (
    permissionKey: string,
    unitId?: string | null,
    membershipId?: string | null,
  ) => {
    try {
      const supabase = await createServerSupabaseClient();
      const orgId = await supabase.rpc("current_organisation_id");
      const orgClassified = classifyPermissionProbeResult(orgId);
      if (!orgClassified.ok) {
        if (
          orgClassified.outcome === "denied" ||
          orgClassified.outcome === "not_found"
        ) {
          return false;
        }

        return throwClassifiedProbeFailure(
          orgClassified,
          "current_organisation_id",
          permissionKey,
        );
      }

      if (!orgClassified.data) {
        return false;
      }

      const args: {
        target_organisation_id: string;
        target_permission_key: string;
        target_membership_id?: string;
        target_unit_id?: string;
      } = {
        target_organisation_id: orgClassified.data,
        target_permission_key: permissionKey,
      };

      if (membershipId) {
        args.target_membership_id = membershipId;
      }

      if (unitId) {
        args.target_unit_id = unitId;
      }

      const result = await supabase.rpc("has_scoped_permission", args);
      const classified = classifyPermissionProbeResult(result);
      if (!classified.ok) {
        if (
          classified.outcome === "denied" ||
          classified.outcome === "not_found"
        ) {
          return false;
        }

        return throwClassifiedProbeFailure(
          classified,
          "has_scoped_permission",
          permissionKey,
        );
      }

      return classified.data === true;
    } catch (error) {
      rethrowProbeControlErrors(error);
      return throwPermissionProbeFailure(
        "has_scoped_permission",
        permissionKey,
        error,
      );
    }
  },
);

export async function currentMemberHasOrganisationScopedPermission(
  permissionKey: string,
) {
  return currentMemberHasScopedPermission(permissionKey);
}

export const currentMemberCanDelegateRoles = cache(async () =>
  currentMemberHasPermission("roles.delegate"),
);

/** @deprecated Use currentMemberCanDelegateRoles for UI gates. */
export async function currentMemberHasDelegatableAccess() {
  return currentMemberCanDelegateRoles();
}

export type DelegatableAccessOffersPayload = {
  offers: unknown[];
};

export const loadDelegatableAccessOffers = cache(async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const result = await supabase.rpc("get_delegatable_access_offers");
    const classified = classifyPermissionProbeResult(result);
    if (!classified.ok) {
      if (
        classified.outcome === "denied" ||
        classified.outcome === "not_found"
      ) {
        return { offers: [] } satisfies DelegatableAccessOffersPayload;
      }

      return throwClassifiedProbeFailure(
        classified,
        "get_delegatable_access_offers",
        "delegatable_access",
      );
    }

    const offers =
      (classified.data as DelegatableAccessOffersPayload | null)?.offers ?? [];
    return { offers } satisfies DelegatableAccessOffersPayload;
  } catch (error) {
    rethrowProbeControlErrors(error);
    return throwPermissionProbeFailure(
      "get_delegatable_access_offers",
      "delegatable_access",
      error,
    );
  }
});
