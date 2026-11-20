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
    <header className="marketing-header">
      <div className="marketing-header-bar">
        <MarketingContainer className="flex items-center gap-2 py-3 sm:gap-4">
          <Link
            href="/"
            className="leh-brand-link marketing-home-link"
            aria-label={LEH_BRAND_HOME_LABEL}
          >
            <MarketingWordmark decorative priority />
          </Link>

          <nav
            aria-label="Primary"
            className="ml-2 hidden items-center gap-6 lg:flex lg:gap-7"
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

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden lg:inline-flex"
            >
              <Link href="/login">Sign in</Link>
            </Button>
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
            <div className="flex flex-col gap-3">
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </MarketingContainer>
        </div>
      </div>
    </header>
  );
}
