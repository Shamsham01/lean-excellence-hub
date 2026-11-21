import type { ReactNode } from "react";

import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";

import "./v6/tokens.css";
import "./v6/v6.css";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing marketing-landing leh-v6 min-h-dvh">
      <div className="v6-canvas" aria-hidden="true" />
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
