"use client";

import { useEffect } from "react";

import type { UnitSelectOption } from "@/modules/organisation/site-context";

const SELECT_CLASS_NAME =
  "border-input min-h-11 rounded-md border bg-background px-3 py-2";

type OrganisationalUnitSelectProps = {
  id?: string;
  name?: string;
  label: string;
  options: UnitSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (unitId: string) => void;
  required?: boolean;
  disabled?: boolean;
  requiresSiteSelection?: boolean;
  emptyMessage?: string;
  testId?: string;
};

export function OrganisationalUnitSelect({
  id = "organisational-unit",
  name,
  label,
  options,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  requiresSiteSelection = false,
  emptyMessage,
  testId = "organisational-unit-select",
}: OrganisationalUnitSelectProps) {
  useEffect(() => {
    if (value === undefined || !onChange) {
      return;
    }
    if (options.length === 0) {
      if (value !== "") {
        onChange("");
      }
      return;
    }
    if (!options.some((option) => option.id === value)) {
      onChange(options[0]!.id);
    }
  }, [onChange, options, value]);

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-1 text-sm">
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
    <label className="flex flex-col gap-1 text-sm">
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
        {options.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
    </label>
  );
}
