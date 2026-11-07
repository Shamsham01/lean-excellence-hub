"use client";

import { PlatformChromeActions } from "@/components/platform/platform-chrome-actions";

/**
 * Desktop-only toolbar in the main column (sidebar remains the primary nav).
 * Mobile uses {@link MobilePlatformNavigation} instead — do not duplicate a second sticky row under it.
 */
export function PlatformDesktopMainChrome() {
  return (
    <div
      data-testid="platform-desktop-main-chrome"
      className="sticky top-0 z-30 hidden shrink-0 items-center justify-end gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm lg:flex lg:px-8"
    >
      <PlatformChromeActions />
    </div>
  );
}
