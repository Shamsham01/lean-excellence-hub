"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-11 w-full justify-start gap-2 text-sidebar-foreground"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <span suppressHydrationWarning>
        {resolvedTheme === "dark" ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )}
      </span>
      <span>Theme</span>
    </Button>
  );
}

export function ThemeToggleIcon() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 min-h-10 rounded-[10px] shadow-[var(--shadow-theme-xs)]"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      data-testid="platform-theme-toggle"
    >
      <span suppressHydrationWarning>
        {resolvedTheme === "dark" ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )}
      </span>
    </Button>
  );
}
