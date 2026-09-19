"use client";

import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

import {
  resolveAppHref,
  shouldPreserveBrowserDefault,
  type AppHref,
} from "@/lib/navigation/app-link-click";
import { hardNavigate } from "@/lib/navigation/navigate";

export type AppLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: AppHref;
  replace?: boolean;
  prefetch?: boolean;
  scroll?: boolean;
};

/**
 * Shared in-app link. NAV-CLICK-001: Next.js `<Link>` preventDefault()s the
 * click and starts an App Router transition that frequently aborts on
 * compiled/hosted servers (focus/active styling, no URL change). This
 * wrapper keeps a real `href` and uses document navigation for ordinary
 * primary clicks so platform nav, list rows, and cross-entity links move.
 * Modified clicks (cmd/ctrl/shift/alt/middle) keep browser defaults.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink(
    {
      href,
      replace = false,
      prefetch,
      scroll,
      onClick,
      target,
      download,
      ...props
    },
    ref,
  ) {
    void prefetch;
    void scroll;
    const resolvedHref = resolveAppHref(href);

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
      onClick?.(event);

      if (
        shouldPreserveBrowserDefault(event, {
          href: resolvedHref,
          ...(target ? { target } : {}),
          download: Boolean(download),
        })
      ) {
        return;
      }

      if (replace) {
        event.preventDefault();
        hardNavigate(resolvedHref, true);
      }
    }

    return (
      <a
        ref={ref}
        href={resolvedHref}
        onClick={handleClick}
        {...(target ? { target } : {})}
        {...(download ? { download } : {})}
        {...props}
      />
    );
  },
);

AppLink.displayName = "AppLink";

export { AppLink as Link };
export default AppLink;
