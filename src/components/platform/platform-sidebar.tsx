"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  CalendarDays,
  ClipboardList,
  FileText,
  Footprints,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Sparkles,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/platform/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  isNavActive,
  type PlatformNavItem,
  type PlatformNavSection,
} from "@/modules/platform-shell/navigation";
import { cn } from "@/lib/utils";

const navIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Maturity: Layers,
  "5S": Sparkles,
  Gemba: Footprints,
  Schedule: CalendarDays,
  Actions: ClipboardList,
  Templates: FileText,
  People: Users,
  Training: GraduationCap,
  Skills: Award,
};

const sectionLabels: Record<PlatformNavSection, string | null> = {
  main: null,
  improvement: "Improvement system",
  people: "People & capability",
  platform: "Platform",
};

type SidebarNavProps = {
  items: PlatformNavItem[];
  organisationName: string;
  organisations: Array<{
    organisation_id: string;
    organisation_name: string;
    selected: boolean;
  }>;
};

function NavLink({
  item,
  pathname,
}: {
  item: PlatformNavItem;
  pathname: string;
}) {
  const active = isNavActive(pathname, item.href);
  const Icon = navIcons[item.label] ?? Home;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent({
  items,
  organisationName,
  organisations,
  pathname,
}: SidebarNavProps & { pathname: string }) {
  const sections: PlatformNavSection[] = [
    "main",
    "improvement",
    "people",
    "platform",
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 p-4">
        <p className="typography-product-identity">Lean Hub</p>
        <div>
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {organisationName}
          </p>
          {organisations.length > 1 ? (
            <Link
              href="/select-organisation"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Switch organisation
            </Link>
          ) : null}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Platform">
        {sections.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;
          const label = sectionLabels[section];
          return (
            <div key={section}>
              {label ? (
                <p className="typography-section-title px-3 pt-4 pb-1">
                  {label}
                </p>
              ) : null}
              {sectionItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 p-2">
        <Separator className="mb-2" />
        <ThemeToggle />
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

export function PlatformSidebar(props: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <SidebarContent {...props} pathname={pathname} />
      </aside>

      <div className="flex items-center gap-2 border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" type="button">
              Menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-sidebar p-0">
            <SheetHeader className="p-4 pb-0">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent {...props} pathname={pathname} />
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-semibold">
          {props.organisationName}
        </span>
      </div>
    </>
  );
}
