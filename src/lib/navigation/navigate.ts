/**
 * Document navigation used when App Router client transitions abort
 * (NAV-CLICK-001). Do not pair this with router.refresh() — a concurrent
 * refresh cancels the in-flight destination.
 */
export function hardNavigate(href: string, replace = false): void {
  if (typeof window === "undefined") {
    return;
  }

  if (replace) {
    window.location.replace(href);
    return;
  }

  window.location.assign(href);
}

export function navigateTo(
  href: string,
  options?: { replace?: boolean },
): void {
  hardNavigate(href, options?.replace ?? false);
}
