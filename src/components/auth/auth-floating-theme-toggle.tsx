"use client";

import { ThemeToggleIcon } from "@/components/platform/theme-toggle";

export function AuthFloatingThemeToggle() {
  return (
    <div
      className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6"
      data-testid="auth-theme-toggle"
    >
      <ThemeToggleIcon />
    </div>
  );
}
