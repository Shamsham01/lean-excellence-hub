"use client";

import { LogOut } from "lucide-react";

import { MarketingAppearanceMenu } from "@/components/marketing/appearance-menu";
import { Button } from "@/components/ui/button";

export function PlatformChromeBar() {
  return (
    <div
      data-testid="platform-chrome-bar"
      className="sticky top-0 z-30 flex shrink-0 items-center justify-end gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm lg:px-8 [&_.marketing-icon-button]:border-border [&_.marketing-icon-button]:bg-background [&_.marketing-icon-button]:text-foreground"
    >
      <MarketingAppearanceMenu />
      <form action="/auth/signout" method="post">
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="min-h-9"
          data-testid="platform-chrome-sign-out"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </form>
    </div>
  );
}
