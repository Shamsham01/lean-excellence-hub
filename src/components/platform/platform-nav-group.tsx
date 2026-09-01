import type { PlatformNavItem } from "@/modules/platform-shell/navigation";

import { PlatformNavItemLink } from "./platform-nav-item";
import type { PlatformNavSection } from "@/modules/platform-shell/navigation";

type PlatformNavGroupProps = {
  section: PlatformNavSection;
  label: string | null;
  items: PlatformNavItem[];
  onNavigate?: () => void;
};

export function PlatformNavGroup({
  section,
  label,
  items,
  onNavigate,
}: PlatformNavGroupProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div role="group" aria-label={label ?? undefined}>
      {label ? (
        <p
          className="typography-section-title px-3 pt-3 pb-1 first:pt-1"
          id={`platform-nav-section-${section}`}
        >
          {label}
        </p>
      ) : null}
      <div
        className="flex flex-col gap-0.5"
        aria-labelledby={label ? `platform-nav-section-${section}` : undefined}
      >
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
