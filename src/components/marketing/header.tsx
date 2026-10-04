"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketingContainer, MarketingWordmark } from "./primitives";

const NAV_LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#why", label: "Why LEH" },
  { href: "#leanai", label: "LeanAI" },
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
      <MarketingContainer className="flex items-center justify-between gap-4 py-3.5">
        <Link
          href="/"
          className="rounded-md"
          aria-label="Lean Excellence Hub home"
        >
          <MarketingWordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <a href="#platform">Explore the platform</a>
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
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
                className="rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <a href="#platform" onClick={() => setOpen(false)}>
                Explore the platform
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </MarketingContainer>
      </div>
    </header>
  );
}
