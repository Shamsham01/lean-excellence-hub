import { type NextRequest, NextResponse } from "next/server";

export const PLATFORM_PATHNAME_HEADER = "x-leanhub-pathname";

const MAX_PATHNAME_LENGTH = 200;

export function isSafeRequestPathname(value: string | null | undefined) {
  if (!value || value.length > MAX_PATHNAME_LENGTH) {
    return false;
  }

  return value.startsWith("/");
}

export function createPlatformPassthroughResponse(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PLATFORM_PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
