import { type NextRequest, NextResponse } from "next/server";

export const PLATFORM_PATHNAME_HEADER = "x-leanhub-pathname";
export const PLATFORM_SEARCH_HEADER = "x-leanhub-search";

const MAX_PATHNAME_LENGTH = 200;

export function isSafeRequestPathname(value: string | null | undefined) {
  if (!value || value.length > MAX_PATHNAME_LENGTH) {
    return false;
  }

  return value.startsWith("/");
}

export function safePlatformSearch(search: string) {
  if (!search.startsWith("?") || search.length > 500) {
    return "";
  }

  return search;
}

export function createPlatformPassthroughResponse(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PLATFORM_PATHNAME_HEADER, request.nextUrl.pathname);
  requestHeaders.set(
    PLATFORM_SEARCH_HEADER,
    safePlatformSearch(request.nextUrl.search),
  );
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
