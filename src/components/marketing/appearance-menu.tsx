"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const APPEARANCE_OPTIONS = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

type AppearanceValue = (typeof APPEARANCE_OPTIONS)[number]["value"];

function isAppearanceValue(
  value: string | undefined,
): value is AppearanceValue {
  return value === "system" || value === "light" || value === "dark";
}

const subscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

function optionFor(value: AppearanceValue) {
  return (
    APPEARANCE_OPTIONS.find((option) => option.value === value) ??
    APPEARANCE_OPTIONS[0]
  );
}

export function MarketingAppearanceMenu({
  variant = "icon",
}: {
  variant?: "icon" | "labeled";
}) {
  const isClient = useIsClient();
  const { theme, setTheme } = useTheme();
  const current: AppearanceValue =
    isClient && isAppearanceValue(theme) ? theme : "system";
  const currentOption = optionFor(current);
  const CurrentIcon = currentOption.Icon;

  if (variant === "labeled") {
    return (
      <div
        className="marketing-appearance-group"
        role="group"
        aria-label="Appearance"
      >
        {APPEARANCE_OPTIONS.map((option) => {
          const selected = current === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={selected ? "secondary" : "outline"}
              className="min-h-10 flex-1"
              aria-pressed={selected}
              onClick={() => setTheme(option.value)}
            >
              <option.Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {option.label}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    // Non-modal: a modal menu locks <body> scroll, and a scroll-locked body
    // must never become the sticky header's scroll container.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="marketing-icon-button marketing-appearance-trigger"
          aria-label={`Appearance: ${currentOption.label}`}
          data-appearance={current}
        >
          <CurrentIcon aria-hidden="true" className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="marketing-appearance-menu min-w-44"
        aria-label="Appearance"
      >
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            if (isAppearanceValue(value)) {
              setTheme(value);
            }
          }}
        >
          {APPEARANCE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="gap-2"
            >
              <option.Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
