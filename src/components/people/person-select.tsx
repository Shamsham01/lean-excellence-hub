"use client";

import { useEffect } from "react";

import type { PersonSelectOption } from "@/modules/organisation/site-context";

const SELECT_CLASS_NAME =
  "border-input min-h-11 rounded-md border bg-background px-3 py-2";

type PersonSelectProps = {
  id?: string;
  name?: string;
  label: string;
  options: PersonSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (membershipId: string) => void;
  required?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  requiresSiteSelection?: boolean;
  emptyMessage?: string;
  testId?: string;
};

export function PersonSelect({
  id = "person-select",
  name,
  label,
  options,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  allowEmpty = false,
  emptyOptionLabel = "None",
  requiresSiteSelection = false,
  emptyMessage,
  testId = "person-select",
}: PersonSelectProps) {
  useEffect(() => {
    if (value === undefined || !onChange) {
      return;
    }
    if (allowEmpty) {
      if (value && !options.some((option) => option.id === value)) {
        onChange("");
      }
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
  }, [allowEmpty, onChange, options, value]);

  if (options.length === 0 && !allowEmpty) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <span>{label}</span>
        <p className="text-muted-foreground" data-testid={`${testId}-empty`}>
          {emptyMessage ??
            (requiresSiteSelection
              ? "Select an active site in the sidebar before choosing a person."
              : "No people are available.")}
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
        {allowEmpty ? <option value="">{emptyOptionLabel}</option> : null}
        {options.map((person) => (
          <option key={person.id} value={person.id}>
            {person.label}
          </option>
        ))}
      </select>
    </label>
  );
}
