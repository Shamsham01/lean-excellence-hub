"use client";

import { useMemo, useState } from "react";

import {
  annualSitePriceMinor,
  listPublicPlans,
  resolveListedPriceMinor,
} from "@/modules/billing/catalogue";
import type { SelfServicePlanCode } from "@/modules/billing/types";

function formatGbp(minor: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function OnboardingPlanCheckoutFields() {
  const publicPlans = useMemo(
    () => listPublicPlans().filter((plan) => plan.selfService),
    [],
  );
  const [planCode, setPlanCode] = useState<SelfServicePlanCode>("professional");
  const selectedPlan = publicPlans.find((plan) => plan.code === planCode)!;

  return (
    <>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Plan</legend>
        {publicPlans.map((plan) => (
          <label
            key={plan.code}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
          >
            <input
              type="radio"
              name="planCode"
              value={plan.code}
              checked={planCode === plan.code}
              onChange={() => setPlanCode(plan.code as SelfServicePlanCode)}
              required
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{plan.name}</span>
              <span className="block text-sm text-muted-foreground">
                {formatGbp(plan.monthlySitePriceMinor)} / site / month ·{" "}
                {formatGbp(annualSitePriceMinor(plan.monthlySitePriceMinor))} /
                site / year
              </span>
            </span>
          </label>
        ))}
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          Price is per <strong>site</strong> (location), not per person.
          Unlimited employees per site on every plan. Optional onboarding
          consultancy is quoted separately; no mandatory setup fee in Checkout.
          Enterprise is Contact Sales only.
        </p>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="interval" className="text-sm font-medium">
          Billing interval
        </label>
        <select
          id="interval"
          name="interval"
          defaultValue="monthly"
          className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
        >
          <option value="monthly">
            Monthly · {formatGbp(resolveListedPriceMinor(planCode, "monthly"))}{" "}
            {selectedPlan.name} / site
          </option>
          <option value="annual">
            Annual (10% off) ·{" "}
            {formatGbp(resolveListedPriceMinor(planCode, "annual"))}{" "}
            {selectedPlan.name} / site
          </option>
        </select>
      </div>
    </>
  );
}
