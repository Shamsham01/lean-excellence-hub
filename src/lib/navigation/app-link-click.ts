type AppHrefQuery =
  string | Record<string, string | number | Array<string | number> | undefined>;

export type AppHref =
  | string
  | {
      pathname?: string;
      query?: AppHrefQuery;
      hash?: string;
    };

export type AppLinkClickEvent = {
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
  currentTarget?: EventTarget | null;
  target?: EventTarget | null;
};

const NESTED_INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
].join(",");

export function resolveAppHref(href: AppHref): string {
  if (typeof href === "string") {
    return href;
  }

  const pathname = href.pathname ?? "";
  const search = serializeUrlQuery(href.query);
  const hash = href.hash ?? "";

  return `${pathname}${search}${hash}`;
}

export function isModifiedClick(event: AppLinkClickEvent): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

export function isExternalHref(
  href: string,
  origin = typeof window === "undefined" ? undefined : window.location.origin,
): boolean {
  if (!href || href.startsWith("#") || href.startsWith("?")) {
    return false;
  }

  if (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return true;
  }

  try {
    const url = new URL(href, origin ?? "http://localhost");
    if (!origin) {
      return /^https?:/i.test(href);
    }
    return url.origin !== origin;
  } catch {
    return false;
  }
}

export function isNestedInteractiveTarget(event: AppLinkClickEvent): boolean {
  const target = event.target;
  const currentTarget = event.currentTarget;

  if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
    return false;
  }

  const interactive = target.closest(NESTED_INTERACTIVE_SELECTOR);
  return interactive != null && interactive !== currentTarget;
}

export function shouldPreserveBrowserDefault(
  event: AppLinkClickEvent,
  options: {
    href: string;
    target?: string;
    download?: boolean;
  },
): boolean {
  if (event.defaultPrevented) {
    return true;
  }

  if (isModifiedClick(event)) {
    return true;
  }

  if (options.download) {
    return true;
  }

  if (options.target && options.target !== "_self") {
    return true;
  }

  if (isExternalHref(options.href)) {
    return true;
  }

  if (isNestedInteractiveTarget(event)) {
    return true;
  }

  return false;
}

function serializeUrlQuery(query: AppHrefQuery | undefined): string {
  if (!query) {
    return "";
  }

  if (typeof query === "string") {
    if (!query) {
      return "";
    }
    return query.startsWith("?") ? query : `?${query}`;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, String(entry));
      }
      continue;
    }

    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
