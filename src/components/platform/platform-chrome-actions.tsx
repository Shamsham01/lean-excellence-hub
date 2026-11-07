"use client";

import { LogOut } from "lucide-react";

import { PlatformAppearanceMenu } from "@/components/platform/platform-appearance-menu";
import { Button } from "@/components/ui/button";

/**
 * Shared appearance + sign-out controls for authenticated platform chrome
 * (mobile sticky bar and/or desktop main column — not the sidebar).
 */
export function PlatformChromeActions() {
  return (
    <>
      <PlatformAppearanceMenu />
      <form action="/auth/signout" method="post">
        <Button
          type="submit"
          variant="outline"
          size="icon"
          className="min-h-9 min-w-9"
          aria-label="Sign out"
          data-testid="platform-chrome-sign-out"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      </form>
    </>
  );
}
