import { headers } from "next/headers";

import {
  isSafeRequestPathname,
  PLATFORM_PATHNAME_HEADER,
} from "@/platform/http/pathname-header";

export async function readRequestPathname(): Promise<string | null> {
  try {
    const headerStore = await headers();
    const value = headerStore.get(PLATFORM_PATHNAME_HEADER);
    return isSafeRequestPathname(value) ? value : null;
  } catch {
    return null;
  }
}
