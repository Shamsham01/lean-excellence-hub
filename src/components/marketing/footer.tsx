import Link from "next/link";

import { MarketingAppearanceMenu } from "./appearance-menu";
import { MarketingContainer, MarketingWordmark } from "./primitives";

const PLATFORM_LINKS = [
  { href: "/#platform", label: "Platform" },
  { href: "/#leanai", label: "LeanAI" },
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
    <footer className="marketing-footer">
      <MarketingContainer>
        <div className="marketing-footer-grid">
          <div className="marketing-footer-brand">
            <MarketingWordmark />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              One connected system for Continuous Improvement.
            </p>
          </div>

          <nav aria-label="Platform">
            <p className="marketing-footer-heading">Platform</p>
            <ul className="marketing-footer-list" role="list">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Improvement system">
            <p className="marketing-footer-heading">Improvement system</p>
            <ul className="marketing-footer-list" role="list">
              {SYSTEM_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Access">
            <p className="marketing-footer-heading">Access</p>
            <ul className="marketing-footer-list" role="list">
              <li>
                <Link href="/demo">Request a demo</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="marketing-footer-meta">
          <p>© {new Date().getFullYear()} Lean Excellence Hub</p>
          <MarketingAppearanceMenu />
        </div>
      </MarketingContainer>
    </footer>
  );
}
