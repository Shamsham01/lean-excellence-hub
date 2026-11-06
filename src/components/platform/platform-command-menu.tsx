"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { platformNavigation } from "@/modules/platform-shell/navigation";
import { cn } from "@/lib/utils";

type PlatformCommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PlatformCommandMenu({
  open,
  onOpenChange,
}: PlatformCommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = platformNavigation.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      setQuery("");
      router.push(href);
    },
    [onOpenChange, router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-3 p-0"
        data-testid="platform-command-menu"
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm font-medium">
            Command menu
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules…"
              className="pl-9"
              autoFocus
              data-testid="platform-command-input"
            />
          </div>
        </div>
        <ul className="max-h-64 overflow-y-auto px-2 pb-3" role="listbox">
          {filtered.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                className={cn(
                  "flex w-full rounded-lg px-3 py-2 text-left text-sm",
                  "transition-colors duration-150 hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => navigate(item.href)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
