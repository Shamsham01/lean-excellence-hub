import type { ReactNode } from "react";

import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing min-h-dvh">
      <a className="marketing-skip" href="#main">
        Skip to main content
      </a>
      <MarketingHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
