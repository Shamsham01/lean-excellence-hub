import type { ReactNode } from "react";

import { AuthBrandPanel } from "./auth-brand-panel";
import { AuthFloatingThemeToggle } from "./auth-floating-theme-toggle";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background lg:flex-row">
      <div className="flex w-full min-w-0 flex-1 flex-col lg:w-1/2">
        {children}
      </div>
      <AuthBrandPanel />
      <AuthFloatingThemeToggle />
    </div>
  );
}
