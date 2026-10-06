"use client";

import { useState } from "react";

import { AddSiteCapacityDialog } from "@/components/billing/add-site-capacity-dialog";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { ADD_SITE_HREF } from "@/modules/billing/site-capacity-increase";
import {
  formatBillingSiteCapacityHeadline,
  formatRemainingSiteSlots,
} from "@/modules/billing/site-capacity";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function BillingSiteCapacityPanel({
  activeSiteCount,
  subscribedLimit,
  remainingSlots,
  enforced,
  canIncrease,
  blockedReason,
  fakeBillingEnabled,
  initialOpen = false,
  initialPendingDesired = null,
}: {
  activeSiteCount: number;
  subscribedLimit: number | null;
  remainingSlots: number | null;
  enforced: boolean;
  canIncrease: boolean;
  blockedReason: string | null;
  fakeBillingEnabled: boolean;
  initialOpen?: boolean;
  initialPendingDesired?: number | null;
}) {
  const [open, setOpen] = useState(
    initialOpen ||
      (typeof initialPendingDesired === "number" &&
        subscribedLimit !== null &&
        initialPendingDesired > subscribedLimit),
  );
  const remaining = formatRemainingSiteSlots(remainingSlots);
  const exhausted = enforced && remainingSlots === 0;
  const hasSpareCapacity =
    remainingSlots !== null && remainingSlots > 0 && enforced;

  return (
    <div data-testid="billing-site-capacity">
      <p className="text-xs font-medium text-muted-foreground">Site capacity</p>
      <p
        className="text-sm text-foreground"
        data-testid="billing-site-capacity-headline"
      >
        {enforced && subscribedLimit !== null
          ? formatBillingSiteCapacityHeadline(activeSiteCount, subscribedLimit)
          : `${activeSiteCount} active`}
      </p>
      {remaining ? (
        <p
          className="mt-1 text-xs text-muted-foreground"
          data-testid="billing-site-capacity-remaining"
        >
          {remaining}
        </p>
      ) : null}
      {initialPendingDesired &&
      subscribedLimit !== null &&
      initialPendingDesired > subscribedLimit ? (
        <p
          className="mt-2 text-xs text-muted-foreground"
          data-testid="billing-site-capacity-awaiting"
        >
          Waiting for billing confirmation of {initialPendingDesired} subscribed
          sites.
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {hasSpareCapacity ? (
          <Button size="sm" className={`self-start ${FOCUS_RING}`} asChild>
            <AppLink href={ADD_SITE_HREF} data-testid="billing-add-site">
              Add site
            </AppLink>
          </Button>
        ) : null}
        {canIncrease ? (
          <Button
            type="button"
            size="sm"
            variant={exhausted || !hasSpareCapacity ? "default" : "outline"}
            className={`self-start ${FOCUS_RING}`}
            onClick={() => setOpen(true)}
            data-testid="add-site-capacity"
          >
            Add site capacity
          </Button>
        ) : blockedReason ? (
          <p className="text-xs text-muted-foreground">{blockedReason}</p>
        ) : null}
      </div>
      {subscribedLimit !== null ? (
        <AddSiteCapacityDialog
          open={open}
          onOpenChange={setOpen}
          persistedSiteQuantity={subscribedLimit}
          remainingSlots={remainingSlots}
          fakeBillingEnabled={fakeBillingEnabled}
          canIncrease={canIncrease}
          blockedReason={blockedReason}
          initialPendingDesired={initialPendingDesired}
        />
      ) : null}
    </div>
  );
}
