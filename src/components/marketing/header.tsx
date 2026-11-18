"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { landingNav } from "@/lib/marketing/landing-copy";
import { LEH_BRAND_HOME_LABEL } from "@/components/brand/brand-assets";

import {
  MarketingContainer,
  MarketingWordmark,
  RequestDemoControl,
} from "./primitives";

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Transparent over the hero; solid, blurred and ruled once the page scrolls.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuTrigger.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className="marketing-header"
      data-scrolled={scrolled || open ? "true" : "false"}
    >
      <div className="marketing-header-bar">
        <MarketingContainer className="marketing-header-inner">
          <Link
            href="/"
            className="leh-brand-link marketing-home-link"
            aria-label={LEH_BRAND_HOME_LABEL}
          >
            <MarketingWordmark decorative priority />
          </Link>

          <nav
            aria-label="Primary"
            className="marketing-header-nav hidden lg:flex"
          >
            {landingNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="marketing-nav-link"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="marketing-nav-link marketing-signin">
              Sign in
            </Link>
            <RequestDemoControl size="sm" />
            <Button
              ref={menuTrigger}
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
        </MarketingContainer>

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
              {landingNav.map((item) => (
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
            <div className="marketing-mobile-footer">
              <Link href="/login" className="marketing-mobile-link">
                Sign in
              </Link>
            </div>
          </MarketingContainer>
        </div>
      </div>
    </header>
  );
}
