import Link from "next/link";

import { DEMO_BOOKING_CTA } from "@/lib/marketing/demo-booking";

import { MarketingAppearanceMenu } from "./appearance-menu";
import { MarketingContainer, MarketingWordmark } from "./primitives";

const PLATFORM_LINKS = [
  { href: "/#platform", label: "Platform" },
  { href: "/#why", label: "Why LEH" },
  { href: "/#leanai", label: "LeanAI" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#maturity", label: "Maturity" },
  { href: "/#problem-solving", label: "Problem Solving" },
] as const;

const SYSTEM_LINKS = [
  { href: "/#gemba", label: "Gemba" },
  { href: "/#five-s", label: "5S" },
  { href: "/#suggestions", label: "Suggestions" },
  { href: "/#actions", label: "Actions" },
  { href: "/#projects-benefits", label: "Projects & Benefits" },
  { href: "/#training-skills", label: "Training & Skills" },
] as const;

export function MarketingFooter() {
  return (
    <footer className="marketing-footer marketing-footer-sleek">
      <MarketingContainer>
        <div className="marketing-footer-sleek-grid">
          <div className="marketing-footer-brand">
            <MarketingWordmark compact decorative />
            <p className="marketing-footer-tagline mt-2 max-w-[16rem] text-xs leading-snug text-muted-foreground">
              One connected system for Continuous Improvement.
            </p>
          </div>

          <nav aria-label="Platform" className="marketing-footer-nav-col">
            <p className="marketing-footer-heading">Platform</p>
            <ul className="marketing-footer-list" role="list">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav
            aria-label="Improvement system"
            className="marketing-footer-nav-col"
          >
            <p className="marketing-footer-heading">System</p>
            <ul className="marketing-footer-list" role="list">
              {SYSTEM_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Access" className="marketing-footer-nav-col">
            <p className="marketing-footer-heading">Access</p>
            <ul className="marketing-footer-list" role="list">
              <li>
                <Link href="/demo">{DEMO_BOOKING_CTA}</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="marketing-footer-bottom">
          <p className="marketing-footer-copyright">
            © {new Date().getFullYear()} Lean Excellence Hub
          </p>
          <MarketingAppearanceMenu />
        </div>
      </MarketingContainer>
    </footer>
  );
}
