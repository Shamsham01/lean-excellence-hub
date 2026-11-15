"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string };

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled,
  className,
  id: idProp,
  "aria-label": ariaLabel,
  emptyHint = "No matches",
}: {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  emptyHint?: string;
}) {
  const generatedId = useId();
  const triggerId = idProp ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const node = rootRef.current;
      if (!node || node.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const accessibleName = ariaLabel ?? placeholder;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <Button
        id={triggerId}
        type="button"
        variant="outline"
        disabled={disabled}
        className="h-11 min-h-11 w-full justify-between font-normal"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={accessibleName}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">
          {selected ? (
            selected.label
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </Button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-theme-md)]">
          <Input
            value={query}
            placeholder={searchPlaceholder}
            className="mb-2 h-8"
            aria-label={`${accessibleName} search`}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <ul
            id={listboxId}
            role="listbox"
            aria-label={accessibleName}
            className="max-h-48 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-center text-xs text-muted-foreground">
                {options.length === 0 ? emptyHint : "No matches"}
              </li>
            ) : (
              filtered.map((option) => (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {option.label}
                    {value === option.value ? (
                      <Check className="size-4 text-primary" aria-hidden />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
