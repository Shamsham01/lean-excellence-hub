"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  buildAuthoringSavedRedirectPath,
  type AuthoringSavedKey,
} from "@/lib/authoring/authoring-query";

export function useAuthoringSavedFlash() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (key: AuthoringSavedKey) => {
      const query = searchParams?.toString() ?? "";
      const existingSearch = query ? `?${query}` : "";
      router.replace(
        buildAuthoringSavedRedirectPath(pathname ?? "", key, existingSearch),
        { scroll: false },
      );
    },
    [pathname, router, searchParams],
  );
}
