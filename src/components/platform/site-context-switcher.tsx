"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setActiveSiteContext } from "@/app/(platform)/site-context/actions";
import {
  ALL_SITES_COOKIE_VALUE,
  type ActiveSiteContext,
} from "@/modules/organisation/site-context";

type SiteContextSwitcherProps = {
  context: ActiveSiteContext;
};

export function SiteContextSwitcher({ context }: SiteContextSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (context.mode === "legacy" || context.sites.length === 0) {
    return null;
  }

  if (context.locked && context.sites.length === 1) {
    return (
      <p
        className="truncate text-xs text-muted-foreground"
        data-testid="site-context-label"
      >
        {context.sites[0]?.name}
      </p>
    );
  }

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="sr-only">Active site</span>
      <select
        data-testid="site-context-switcher"
        className="border-input max-w-full truncate rounded-md border bg-background px-2 py-1 text-xs"
        value={context.activeSiteId ?? ALL_SITES_COOKIE_VALUE}
        disabled={pending}
        onChange={(event) => {
          const nextValue = event.target.value;
          startTransition(async () => {
            await setActiveSiteContext(nextValue);
            router.refresh();
          });
        }}
      >
        <option value={ALL_SITES_COOKIE_VALUE}>All sites</option>
        {context.sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}
