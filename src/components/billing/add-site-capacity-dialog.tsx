"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  confirmFakeSiteCapacityIncrease,
  increaseSiteCapacity,
  refreshAuthoritativeSiteCapacity,
} from "@/app/billing/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLink } from "@/components/ui/app-link";
import { MAX_SITE_QUANTITY } from "@/modules/billing/catalogue";
import {
  ADD_SITE_HREF,
  formatSiteQuantityIncreaseReview,
} from "@/modules/billing/site-capacity-increase";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type DialogStep = "choose" | "review" | "pending" | "confirmed";

export function AddSiteCapacityDialog({
  open,
  onOpenChange,
  persistedSiteQuantity,
  fakeBillingEnabled,
  canIncrease,
  blockedReason,
  initialPendingDesired = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persistedSiteQuantity: number;
  remainingSlots: number | null;
  fakeBillingEnabled: boolean;
  canIncrease: boolean;
  blockedReason: string | null;
  initialPendingDesired?: number | null;
}) {
  const router = useRouter();
  const quantityId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const minDesired = persistedSiteQuantity + 1;
  const [userStep, setUserStep] = useState<DialogStep>(
    initialPendingDesired && initialPendingDesired > persistedSiteQuantity
      ? "pending"
      : "choose",
  );
  const [desiredInput, setDesiredInput] = useState(
    String(
      initialPendingDesired && initialPendingDesired > persistedSiteQuantity
        ? initialPendingDesired
        : minDesired,
    ),
  );
  const [desiredQuantity, setDesiredQuantity] = useState(
    initialPendingDesired && initialPendingDesired > persistedSiteQuantity
      ? initialPendingDesired
      : minDesired,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const step: DialogStep =
    userStep === "pending" && persistedSiteQuantity >= desiredQuantity
      ? "confirmed"
      : userStep;

  useEffect(() => {
    if (step !== "review") {
      return;
    }
    confirmRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "pending" || !open) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(() => {
      void refreshAuthoritativeSiteCapacity().then((result) => {
        if (cancelled || !result.ok) {
          return;
        }
        if (result.persistedSiteQuantity >= desiredQuantity) {
          setUserStep("confirmed");
          router.refresh();
        }
      });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [step, open, desiredQuantity, router]);

  function close() {
    onOpenChange(false);
    setError(null);
    setSubmitting(false);
    setUserStep(
      initialPendingDesired && initialPendingDesired > persistedSiteQuantity
        ? "pending"
        : "choose",
    );
  }

  function parseChosenQuantity() {
    const parsed = Number.parseInt(desiredInput, 10);
    if (!Number.isInteger(parsed) || parsed < minDesired) {
      setError(`Choose a total of at least ${minDesired} subscribed sites.`);
      return null;
    }
    if (parsed > MAX_SITE_QUANTITY) {
      setError(`Subscribed site quantity cannot exceed ${MAX_SITE_QUANTITY}.`);
      return null;
    }
    return parsed;
  }

  function continueToReview() {
    const parsed = parseChosenQuantity();
    if (parsed === null) {
      return;
    }
    setError(null);
    setDesiredQuantity(parsed);
    setUserStep("review");
  }

  async function confirmIncrease() {
    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.set("desiredSiteQuantity", String(desiredQuantity));
    const result = await increaseSiteCapacity(formData);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setUserStep("choose");
      return;
    }
    if (result.status === "already_confirmed") {
      setUserStep("confirmed");
      router.refresh();
      return;
    }
    setUserStep("pending");
  }

  async function confirmSandbox() {
    setSubmitting(true);
    setError(null);
    const result = await confirmFakeSiteCapacityIncrease();
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (
      typeof result.persistedSiteQuantity === "number" &&
      result.persistedSiteQuantity >= desiredQuantity
    ) {
      setUserStep("confirmed");
      router.refresh();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent
        className={`max-w-[calc(100%-2rem)] sm:max-w-lg ${FOCUS_RING}`}
        data-testid="add-site-capacity-dialog"
        onOpenAutoFocus={(event) => {
          if (step === "review") {
            event.preventDefault();
            confirmRef.current?.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {step === "confirmed"
              ? "Site capacity confirmed"
              : step === "pending"
                ? "Waiting for billing confirmation"
                : step === "review"
                  ? "Confirm site capacity increase"
                  : "Add site capacity"}
          </DialogTitle>
          <DialogDescription>
            {step === "confirmed"
              ? "Billing has confirmed the new subscribed site quantity. Create the operational site as a separate step."
              : step === "pending"
                ? "Stripe is the billing authority. Lean Excellence Hub will update capacity when the subscription change is confirmed."
                : step === "review"
                  ? formatSiteQuantityIncreaseReview({
                      currentQuantity: persistedSiteQuantity,
                      desiredQuantity,
                    })
                  : canIncrease
                    ? "Choose the new total number of subscribed sites. This does not create a site."
                    : (blockedReason ??
                      "Site capacity cannot be increased for this subscription.")}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && canIncrease ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={quantityId}>Desired total subscribed sites</Label>
            <Input
              id={quantityId}
              type="number"
              inputMode="numeric"
              min={minDesired}
              max={MAX_SITE_QUANTITY}
              step={1}
              value={desiredInput}
              onChange={(event) => setDesiredInput(event.target.value)}
              autoComplete="off"
              className={FOCUS_RING}
              data-testid="desired-site-quantity"
            />
            <p className="text-xs text-muted-foreground">
              Current subscribed quantity is {persistedSiteQuantity}. Enter a
              higher total, up to {MAX_SITE_QUANTITY}.
            </p>
          </div>
        ) : null}

        {step === "pending" ? (
          <p
            className="text-sm text-foreground"
            data-testid="site-capacity-pending"
            role="status"
          >
            Waiting for billing confirmation of {desiredQuantity} subscribed
            sites. Capacity in Lean Excellence Hub still shows{" "}
            {persistedSiteQuantity} until that confirmation arrives.
          </p>
        ) : null}

        {step === "confirmed" ? (
          <p
            className="text-sm text-foreground"
            data-testid="site-capacity-confirmed"
            role="status"
          >
            Subscribed capacity is now {desiredQuantity}. Add the operational
            site from Structure when you are ready.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {step === "choose" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                className={FOCUS_RING}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={continueToReview}
                disabled={!canIncrease}
                className={FOCUS_RING}
                data-testid="site-capacity-continue"
              >
                Continue
              </Button>
            </>
          ) : null}
          {step === "review" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserStep("choose")}
                className={FOCUS_RING}
              >
                Back
              </Button>
              <Button
                ref={confirmRef}
                type="button"
                onClick={() => void confirmIncrease()}
                disabled={submitting}
                className={FOCUS_RING}
                data-testid="site-capacity-confirm"
              >
                {submitting ? "Updating subscription…" : "Confirm increase"}
              </Button>
            </>
          ) : null}
          {step === "pending" ? (
            <>
              {fakeBillingEnabled ? (
                <Button
                  type="button"
                  onClick={() => void confirmSandbox()}
                  disabled={submitting}
                  className={FOCUS_RING}
                  data-testid="site-capacity-confirm-sandbox"
                >
                  {submitting
                    ? "Confirming…"
                    : "Confirm sandbox billing update"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={close}
                className={FOCUS_RING}
              >
                Close
              </Button>
            </>
          ) : null}
          {step === "confirmed" ? (
            <Button variant="default" className={FOCUS_RING} asChild>
              <AppLink
                href={ADD_SITE_HREF}
                data-testid="site-capacity-add-site"
              >
                Add site
              </AppLink>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
