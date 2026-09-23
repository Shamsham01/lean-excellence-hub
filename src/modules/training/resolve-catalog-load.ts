import "server-only";

import { notFound } from "next/navigation";

import { readRequestPathname } from "@/platform/http/request-path";
import {
  PlatformBoundaryError,
  throwPlatformBoundaryError,
} from "@/platform/observability/platform-boundary";
import {
  classifySupabaseError,
  readSupabaseErrorFields,
} from "@/platform/supabase/error-classification";

export async function resolveTrainingCatalogLoadError(
  error: unknown,
  operation: string,
): Promise<never> {
  if (error instanceof PlatformBoundaryError) {
    throw error;
  }

  const kind = classifySupabaseError(error);
  const { code, message } = readSupabaseErrorFields(error);

  switch (kind) {
    case "authorization_denial":
    case "not_found":
      notFound();
    case "auth_session_failure":
      throwPlatformBoundaryError({
        category: "auth",
        operation,
        route: await readRequestPathname(),
        supabaseError: { code, message },
        cause: error,
      });
    case "infrastructure":
    default:
      throwPlatformBoundaryError({
        category: "organisation_access",
        operation,
        route: await readRequestPathname(),
        supabaseError: { code, message },
        cause: error,
      });
  }
}

export async function resolveTrainingCatalogListResult<T>(
  result: { data: T[] | null; error: unknown },
  operation: string,
): Promise<T[]> {
  if (result.error) {
    await resolveTrainingCatalogLoadError(result.error, operation);
  }

  return result.data ?? [];
}

export async function resolveTrainingCatalogRequiredData<T>(
  result: { data: T; error: unknown },
  operation: string,
): Promise<NonNullable<T>> {
  if (result.error) {
    await resolveTrainingCatalogLoadError(result.error, operation);
  }

  if (result.data == null) {
    notFound();
    throw new Error("Training catalogue record was not found.");
  }

  return result.data as NonNullable<T>;
}
