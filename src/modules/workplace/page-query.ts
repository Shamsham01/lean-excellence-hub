import "server-only";

import { headers } from "next/headers";

import {
  PLATFORM_SEARCH_HEADER,
  safePlatformSearch,
} from "@/platform/http/pathname-header";
import { readRequestPathname } from "@/platform/http/request-path";

async function readWorkplaceSearchParams() {
  try {
    const headerStore = await headers();
    const search = safePlatformSearch(
      headerStore.get(PLATFORM_SEARCH_HEADER) ?? "",
    );
    return new URLSearchParams(search.startsWith("?") ? search.slice(1) : "");
  } catch {
    return new URLSearchParams();
  }
}

export async function readWorkplacePage() {
  const params = await readWorkplaceSearchParams();
  const page = Number(params.get("workplace_page"));
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, 100000);
}

export async function workplacePageHref(page: number) {
  const pathname = (await readRequestPathname()) ?? "/platform";
  const params = await readWorkplaceSearchParams();
  if (page <= 1) {
    params.delete("workplace_page");
  } else {
    params.set("workplace_page", String(page));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
