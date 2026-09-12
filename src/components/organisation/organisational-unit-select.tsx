"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import {
  isSelectorPreferredValueMissing,
  nextSelectorValue,
  type UnitSelectOption,
} from "@/modules/organisation/site-context";

const SELECT_CLASS_NAME =
  "border-input min-h-11 w-full min-w-[12rem] rounded-md border bg-background px-3 py-2";

type OrganisationalUnitSelectProps = {
  id?: string;
  name?: string;
  label: string;
  options: UnitSelectOption[];
  value?: string;
  defaultValue?: string;
  preferredValue?: string;
  onChange?: (unitId: string) => void;
  required?: boolean;
  disabled?: boolean;
  requiresSiteSelection?: boolean;
  emptyMessage?: string;
  placeholderLabel?: string;
  unavailableMessage?: string;
  testId?: string;
  className?: string;
};

export function OrganisationalUnitSelect({
  id = "organisational-unit",
  name,
  label,
  options,
  value,
  defaultValue,
  preferredValue,
  onChange,
  required,
  disabled,
  requiresSiteSelection = false,
  emptyMessage,
  placeholderLabel = "Select organisational unit…",
  unavailableMessage = "The previously selected organisational unit is not available in the active site. Choose a unit.",
  testId = "organisational-unit-select",
  className,
}: OrganisationalUnitSelectProps) {
  useEffect(() => {
    if (value === undefined || !onChange) {
      return;
    }
    const next = nextSelectorValue({ options, value });
    if (next !== value) {
      onChange(next);
    }
  }, [onChange, options, value]);

  const selectedValue = value ?? defaultValue ?? "";
  const preferredMissing = isSelectorPreferredValueMissing(
    options,
    preferredValue,
  );

  if (options.length === 0) {
    return (
      <div className={cn("flex min-w-0 flex-col gap-1 text-sm", className)}>
        <span>{label}</span>
        <p
          className="text-muted-foreground"
          data-testid="site-context-required"
        >
          {emptyMessage ??
            (requiresSiteSelection
              ? "Select an active site in the sidebar before choosing an organisational unit."
              : "No organisational units are available.")}
        </p>
      </div>
    );
  }

  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-sm", className)}>
      <span>{label}</span>
      <select
        id={id}
        name={name}
        className={SELECT_CLASS_NAME}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        required={required}
        disabled={disabled}
        data-testid={testId}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
      >
        <option value="" disabled={Boolean(required && selectedValue)}>
          {placeholderLabel}
        </option>
        {options.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
      {preferredMissing ? (
        <p className="text-destructive" data-testid={`${testId}-unavailable`}>
          {unavailableMessage}
        </p>
      ) : null}
    </label>
  );
}
