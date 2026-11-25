"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  buildAuthoringSavedRedirectPath,
  type AuthoringSavedKey,
} from "@/lib/authoring/authoring-query";

export function useAuthoringSavedFlash(shallow = false) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (key: AuthoringSavedKey) => {
      const query = searchParams?.toString() ?? "";
      const existingSearch = query ? `?${query}` : "";
      const path = buildAuthoringSavedRedirectPath(
        pathname ?? "",
        key,
        existingSearch,
      );
      if (shallow) {
        window.history.replaceState(null, "", path);
      } else {
        router.replace(path, { scroll: false });
      }
    },
    [pathname, router, searchParams, shallow],
  );
}
