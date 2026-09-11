"use client";

import { useEffect } from "react";

import {
  isSelectorPreferredValueMissing,
  nextSelectorValue,
  type PersonSelectOption,
} from "@/modules/organisation/site-context";

const SELECT_CLASS_NAME =
  "border-input min-h-11 rounded-md border bg-background px-3 py-2";

type PersonSelectProps = {
  id?: string;
  name?: string;
  label: string;
  options: PersonSelectOption[];
  value?: string;
  defaultValue?: string;
  preferredValue?: string;
  onChange?: (membershipId: string) => void;
  required?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  placeholderLabel?: string;
  requiresSiteSelection?: boolean;
  emptyMessage?: string;
  unavailableMessage?: string;
  testId?: string;
};

export function PersonSelect({
  id = "person-select",
  name,
  label,
  options,
  value,
  defaultValue,
  preferredValue,
  onChange,
  required,
  disabled,
  allowEmpty = false,
  emptyOptionLabel = "None",
  placeholderLabel = "Select person…",
  requiresSiteSelection = false,
  emptyMessage,
  unavailableMessage = "The previously selected person is not available in the active site. Choose a person.",
  testId = "person-select",
}: PersonSelectProps) {
  useEffect(() => {
    if (value === undefined || !onChange) {
      return;
    }
    const next = nextSelectorValue({ options, value, allowEmpty });
    if (next !== value) {
      onChange(next);
    }
  }, [allowEmpty, onChange, options, value]);

  const selectedValue = value ?? defaultValue ?? "";
  const preferredMissing = isSelectorPreferredValueMissing(
    options,
    preferredValue,
  );

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
        {allowEmpty ? (
          <option value="">{emptyOptionLabel}</option>
        ) : (
          <option value="" disabled={Boolean(required && selectedValue)}>
            {placeholderLabel}
          </option>
        )}
        {options.map((person) => (
          <option key={person.id} value={person.id}>
            {person.label}
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
