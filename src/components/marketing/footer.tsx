import Link from "next/link";

import { landingNav } from "@/lib/marketing/landing-copy";

import {
  GetFreeAccessControl,
  MarketingContainer,
  MarketingWordmark,
  RequestDemoControl,
} from "./primitives";

export function MarketingFooter() {
  return (
    <footer className="marketing-footer marketing-footer-sleek">
      <MarketingContainer>
        <div className="marketing-footer-sleek-grid">
          <div className="marketing-footer-brand">
            <MarketingWordmark />
          </div>

          <nav aria-label="Platform" className="marketing-footer-nav-col">
            <p className="marketing-footer-heading">Platform</p>
            <ul className="marketing-footer-list" role="list">
              {landingNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Access" className="marketing-footer-nav-col">
            <p className="marketing-footer-heading">Access</p>
            <ul className="marketing-footer-list" role="list">
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
            <div className="marketing-footer-ctas">
              <RequestDemoControl size="sm" />
              <GetFreeAccessControl size="sm" />
            </div>
          </nav>
        </div>

        <div className="marketing-footer-bottom">
          <p className="marketing-footer-copyright">
            © {new Date().getFullYear()} Lean Excellence Hub
          </p>
          <nav aria-label="Legal" className="marketing-footer-legal">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </nav>
        </div>
      </MarketingContainer>
    </footer>
  );
}
