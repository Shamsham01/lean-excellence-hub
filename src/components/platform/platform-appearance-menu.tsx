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

/**
 * Product shell appearance control (Light / Dark / System).
 * Does not use marketing CSS tokens — keep authenticated chrome on product styles only.
 */
export function PlatformAppearanceMenu() {
  const isClient = useIsClient();
  const { theme, setTheme } = useTheme();
  const current: AppearanceValue =
    isClient && isAppearanceValue(theme) ? theme : "system";
  const currentOption = optionFor(current);
  const CurrentIcon = currentOption.Icon;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-9 min-w-9 border-border bg-background text-foreground"
          aria-label={`Appearance: ${currentOption.label}`}
          data-appearance={current}
          data-testid="platform-appearance-trigger"
        >
          <CurrentIcon aria-hidden="true" className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-44"
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
