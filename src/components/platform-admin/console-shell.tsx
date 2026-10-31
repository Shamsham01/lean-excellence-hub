import type { ReactNode } from "react";

import { AppLink } from "@/components/ui/app-link";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/org_admin", label: "Overview" },
  { href: "/org_admin/organisations", label: "Organisations" },
  { href: "/org_admin/notifications", label: "Notifications" },
] as const;

export function PlatformConsoleShell({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 md:px-6">
        <header className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Lean Excellence Hub
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Platform owner
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Read-only view across organisations. Customer administration stays
              in each organisation.
            </p>
          </div>
          <form action="/api/org-admin/logout" method="post">
            <button
              className="min-h-11 rounded-md border border-border px-3 text-sm hover:bg-muted"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </header>
        <nav aria-label="Platform owner" className="flex flex-wrap gap-2">
          {LINKS.map((link) => {
            const current =
              link.href === "/org_admin"
                ? pathname === "/org_admin"
                : pathname.startsWith(link.href);
            return (
              <AppLink
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-3 text-sm",
                  current
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted",
                )}
              >
                {link.label}
              </AppLink>
            );
          })}
        </nav>
        <main className="flex flex-col gap-8 pb-10">{children}</main>
      </div>
    </div>
  );
}
