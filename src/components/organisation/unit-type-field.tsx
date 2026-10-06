"use client";

import { useId, useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatRemainingSiteSlots,
  type SiteCapacityView,
} from "@/modules/billing/site-capacity";
import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import {
  COMMON_UNIT_TYPES,
  CUSTOM_UNIT_TYPE_CHOICE,
  resolveUnitTypeChoice,
  siteTypeCreationHint,
} from "@/modules/organisation/unit-types";

function siteTypeCapacityNote(siteCapacity?: SiteCapacityView) {
  if (!siteCapacity?.enforced) {
    return null;
  }
  if (siteCapacity.remainingSlots === 0) {
    return "This organisation has used all subscribed site capacity.";
  }
  const remaining = formatRemainingSiteSlots(siteCapacity.remainingSlots);
  return remaining ? `${remaining}.` : null;
}

export function UnitTypeField({
  id,
  value,
  onChange,
  required = true,
  siteCapacity,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  siteCapacity?: SiteCapacityView;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const choiceId = `${fieldId}-choice`;
  const customId = fieldId;
  const resolvedChoice = resolveUnitTypeChoice(value);
  const [customSelected, setCustomSelected] = useState(
    resolvedChoice === CUSTOM_UNIT_TYPE_CHOICE,
  );
  const choice =
    customSelected || resolvedChoice === CUSTOM_UNIT_TYPE_CHOICE
      ? CUSTOM_UNIT_TYPE_CHOICE
      : resolvedChoice;
  const customValue = choice === CUSTOM_UNIT_TYPE_CHOICE ? value : "";
  const siteHint = siteTypeCreationHint(value);
  const siteCapacityNote = isSiteUnitType(value)
    ? siteTypeCapacityNote(siteCapacity)
    : null;
  const siteWarning = [siteHint, siteCapacityNote].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={choiceId}>
        <ContextualHelpLabel topic="unit-type">Unit type</ContextualHelpLabel>
      </Label>
      <select
        id={choiceId}
        className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
        value={choice}
        onChange={(event) => {
          const nextChoice = event.target.value;
          if (nextChoice === CUSTOM_UNIT_TYPE_CHOICE) {
            setCustomSelected(true);
            onChange(resolvedChoice === CUSTOM_UNIT_TYPE_CHOICE ? value : "");
            return;
          }
          setCustomSelected(false);
          onChange(nextChoice);
        }}
        required={required}
        data-testid="unit-type-choice"
      >
        <option value="" disabled>
          Select a type
        </option>
        {COMMON_UNIT_TYPES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM_UNIT_TYPE_CHOICE}>Custom</option>
      </select>
      {choice === CUSTOM_UNIT_TYPE_CHOICE ? (
        <Input
          id={customId}
          value={customValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder="For example, ward or cell"
          required={required}
          data-testid="unit-type"
        />
      ) : (
        <input type="hidden" value={value} data-testid="unit-type-value" />
      )}
      <p className="text-xs text-muted-foreground">
        Sites such as plants, factories and locations are billable security
        boundaries. They are not offered as a routine type here.
      </p>
      {siteWarning ? (
        <p
          className="text-xs text-warning-foreground"
          role="status"
          data-testid="site-type-capacity-hint"
        >
          {siteWarning}
        </p>
      ) : null}
    </div>
  );
}
