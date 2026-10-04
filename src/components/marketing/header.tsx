"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketingAppearanceMenu } from "./appearance-menu";
import {
  MarketingContainer,
  MarketingWordmark,
  RequestDemoControl,
} from "./primitives";

const NAV_LINKS = [
  { href: "/#try-leh", label: "Try LEH" },
  { href: "/#platform", label: "Platform" },
  { href: "/#why", label: "Why LEH" },
  { href: "/#leanai", label: "LeanAI" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

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
    <header className="marketing-header">
      <MarketingContainer className="flex items-center gap-3 py-3 sm:gap-4">
        <Link
          href="/"
          className="rounded-md"
          aria-label="Lean Excellence Hub home"
        >
          <MarketingWordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="ml-2 hidden items-center gap-6 md:flex lg:gap-7"
        >
          {NAV_LINKS.map((item) => (
            <a key={item.href} href={item.href} className="marketing-nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <MarketingAppearanceMenu />
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <RequestDemoControl size="sm" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 min-h-9 md:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </MarketingContainer>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "border-t border-border bg-background md:hidden",
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
            <RequestDemoControl />
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </MarketingContainer>
      </div>
    </header>
  );
}
