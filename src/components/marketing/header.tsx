"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketingAppearanceMenu } from "./appearance-menu";
import { LEH_BRAND_HOME_LABEL } from "@/components/brand/brand-assets";

import {
  MarketingContainer,
  MarketingWordmark,
  RequestDemoControl,
  RequestFreeAccessControl,
} from "./primitives";

const NAV_LINKS = [
  { href: "/#platform", label: "Platform" },
  { href: "/#why", label: "Why LEH" },
  { href: "/#leanai", label: "LeanAI" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="marketing-header" data-scrolled={scrolled}>
      <div className="marketing-header-bar">
        <div className="v6-container">
          <Link
            href="/"
            className="leh-brand-link shrink-0"
            aria-label={LEH_BRAND_HOME_LABEL}
          >
            <MarketingWordmark decorative priority />
          </Link>

          <nav
            aria-label="Primary"
            className="ml-2 hidden items-center gap-6 lg:flex lg:gap-7"
          >
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="marketing-nav-link"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <MarketingAppearanceMenu />
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <RequestFreeAccessControl size="sm" />
            </div>
            <RequestDemoControl size="sm" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="marketing-icon-button lg:hidden"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? (
                <X aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <Menu aria-hidden="true" className="size-4 shrink-0" />
              )}
            </Button>
          </div>
        </div>

        <div
          id={panelId}
          hidden={!open}
          className={cn(
            "marketing-mobile-panel lg:hidden",
            open ? "block" : "hidden",
          )}
        >
          <MarketingContainer className="flex flex-col gap-4 py-4">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="marketing-mobile-link"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex flex-col gap-3">
              <p className="marketing-footer-heading">Appearance</p>
              <MarketingAppearanceMenu variant="labeled" />
              <RequestFreeAccessControl />
              <Button asChild variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </MarketingContainer>
        </div>
      </div>
    </header>
  );
}
