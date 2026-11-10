"use client";

import { useEffect, useId, useState, startTransition } from "react";
import { ChevronDown } from "lucide-react";

import type { PlatformNavItem } from "@/modules/platform-shell/navigation";
import type { PlatformNavSection } from "@/modules/platform-shell/navigation";
import { PlatformNavItemLink } from "@/components/platform/platform-nav-item";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "leh-platform-nav-collapsed:";

function readCollapsed(section: PlatformNavSection): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${section}`);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCollapsed(section: PlatformNavSection, collapsed: boolean) {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${section}`,
      collapsed ? "true" : "false",
    );
  } catch {
    /* ignore */
  }
}

function groupContainsPath(items: PlatformNavItem[], pathname: string) {
  return items.some(
    (item) =>
      pathname === item.href ||
      (item.href !== "/platform" && pathname.startsWith(`${item.href}/`)),
  );
}

type PlatformNavGroupCollapsibleProps = {
  section: PlatformNavSection;
  label: string | null;
  items: PlatformNavItem[];
  activePathname?: string;
  onNavigate?: () => void;
};

export function PlatformNavGroupCollapsible({
  section,
  label,
  items,
  activePathname,
  onNavigate,
}: PlatformNavGroupCollapsibleProps) {
  const panelId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readCollapsed(section);
    const containsActive =
      activePathname != null && groupContainsPath(items, activePathname);
    if (containsActive) {
      startTransition(() => setCollapsed(false));
    } else if (stored !== null) {
      startTransition(() => setCollapsed(stored));
    }
    startTransition(() => setHydrated(true));
  }, [activePathname, items, section]);

  if (items.length === 0) {
    return null;
  }

  const toggle = () => {
    setCollapsed((value) => {
      const next = !value;
      writeCollapsed(section, next);
      return next;
    });
  };

  if (!label) {
    return (
      <div role="group">
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <PlatformNavItemLink
              key={item.href}
              item={item}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ))}
        </div>
      </div>
    );
  }

  const expanded = hydrated ? !collapsed : true;

  return (
    <div role="group" aria-label={label}>
      <button
        type="button"
        className="typography-section-title flex w-full items-center justify-between gap-2 rounded-md px-3 pt-3 pb-1 text-left first:pt-1 hover:bg-sidebar-accent/50"
        aria-expanded={expanded}
        aria-controls={panelId}
        id={`platform-nav-section-${section}`}
        data-testid={`platform-nav-section-toggle-${section}`}
        onClick={toggle}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !expanded && "-rotate-90",
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        hidden={!expanded}
        className={cn("flex flex-col gap-0.5", !expanded && "hidden")}
        aria-labelledby={`platform-nav-section-${section}`}
      >
        {expanded
          ? items.map((item) => (
              <PlatformNavItemLink
                key={item.href}
                item={item}
                {...(onNavigate ? { onNavigate } : {})}
              />
            ))
          : null}
      </div>
    </div>
  );
}
