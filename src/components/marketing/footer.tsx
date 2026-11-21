import Link from "next/link";

import {
  DEMO_BOOKING_CTA,
  GET_FREE_ACCESS_CTA,
  GET_FREE_ACCESS_HREF,
} from "@/lib/marketing/demo-booking";

import { MarketingAppearanceMenu } from "./appearance-menu";
import { MarketingWordmark } from "./primitives";

const PLATFORM_LINKS = [
  { href: "/#platform", label: "Platform" },
  { href: "/#why", label: "Why LEH" },
  { href: "/#leanai", label: "LeanAI" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function MarketingFooter() {
  return (
    <footer className="marketing-footer v6-footer">
      <div className="v6-container">
        <div className="v6-footer-grid">
          <div className="v6-footer-brand">
            <MarketingWordmark compact decorative />
            <p>One connected system for Continuous Improvement.</p>
          </div>

          <div className="v6-footer-col">
            <h2>Platform</h2>
            <ul role="list">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="v6-footer-col">
            <h2>Access</h2>
            <ul role="list">
              <li>
                <Link href="/demo">{DEMO_BOOKING_CTA}</Link>
              </li>
              <li>
                <Link href={GET_FREE_ACCESS_HREF}>{GET_FREE_ACCESS_CTA}</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
          </div>

          <div className="v6-footer-col">
            <h2>Company</h2>
            <ul role="list">
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="v6-footer-bottom">
          <p className="m-0">
            © {new Date().getFullYear()} Lean Excellence Hub
          </p>
          <MarketingAppearanceMenu />
        </div>
      </div>
    </footer>
  );
}
