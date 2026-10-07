"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { transferOrganisationOwnership } from "@/app/(platform)/platform/settings/organisation/ownership/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { organisationNameMatchesConfirmation } from "@/modules/organisation-ownership/confirmation";
import type {
  OrganisationOwnerSummary,
  OwnershipTransferTarget,
} from "@/modules/organisation-ownership/types";

type TransferStep = "choose" | "review" | "confirm" | "complete";

const STEPS: Array<{ id: TransferStep; label: string }> = [
  { id: "choose", label: "Choose" },
  { id: "review", label: "Review" },
  { id: "confirm", label: "Confirm" },
  { id: "complete", label: "Complete" },
];

function ownerIdentity(owner: { displayName: string; email: string | null }) {
  return owner.email
    ? `${owner.displayName} (${owner.email})`
    : owner.displayName;
}

export function OwnershipTransferWorkspace({
  organisationName,
  currentOwner,
  targets,
}: {
  organisationName: string;
  currentOwner: OrganisationOwnerSummary | null;
  targets: OwnershipTransferTarget[];
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmationId = useId();
  const errorId = useId();
  const [step, setStep] = useState<TransferStep>("choose");
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirmationName, setConfirmationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = targets.find((target) => target.membershipId === selectedId);
  const confirmationMatches = organisationNameMatchesConfirmation(
    organisationName,
    confirmationName,
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function goTo(next: TransferStep) {
    setError(null);
    setStep(next);
  }

  function continueFromChoose() {
    if (!selected) {
      setError(
        "Choose an active member of this organisation. Invite them first if they are not yet a member.",
      );
      return;
    }
    goTo("review");
  }

  function executeTransfer() {
    if (!selected || !confirmationMatches) {
      setError(`Type ${organisationName} exactly to confirm.`);
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await transferOrganisationOwnership({
        targetMembershipId: selected.membershipId,
        confirmationName,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      setStep("complete");
    });
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <section
      className="flex max-w-3xl flex-col gap-8"
      data-testid="ownership-transfer-workspace"
    >
      <ol
        className="flex flex-wrap gap-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        aria-label="Transfer steps"
      >
        {STEPS.map((item, index) => (
          <li
            key={item.id}
            className={
              item.id === step ? "text-foreground" : "text-muted-foreground"
            }
            aria-current={item.id === step ? "step" : undefined}
          >
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>

      <p className="sr-only" aria-live="polite">
        Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex]?.label}
      </p>

      {error ? (
        <p
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
          data-testid="ownership-transfer-error"
        >
          {error}
        </p>
      ) : null}

      {step === "choose" ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-base font-medium text-foreground"
            >
              Choose the new organisation owner
            </h2>
            <p className="text-sm text-muted-foreground">
              The new owner must already be an active member of{" "}
              {organisationName}. Invitation and ownership transfer stay two
              separate steps.
            </p>
          </div>

          {targets.length === 0 ? (
            <div
              className="flex flex-col gap-4"
              data-testid="ownership-no-eligible-targets"
            >
              <p className="text-sm text-muted-foreground">
                There is no eligible member yet. Invite the person through
                People, wait until their membership is active, then return here.
              </p>
              <Button asChild className="min-h-11 self-start">
                <AppLink href="/platform/settings/people">
                  Invite through People
                </AppLink>
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                continueFromChoose();
              }}
            >
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium text-foreground">
                  Active members
                </legend>
                {targets.map((target) => (
                  <label
                    key={target.membershipId}
                    className="flex cursor-pointer gap-3 border-b border-border/70 py-3 last:border-b-0"
                    data-testid={`ownership-target-${target.membershipId}`}
                  >
                    <input
                      type="radio"
                      name="ownership-target"
                      value={target.membershipId}
                      checked={selectedId === target.membershipId}
                      onChange={() => setSelectedId(target.membershipId)}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">
                        {target.displayName}
                      </span>
                      {target.email ? (
                        <span className="text-sm text-muted-foreground">
                          {target.email}
                        </span>
                      ) : null}
                      {target.isAlreadyOwner ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          Already an owner
                        </span>
                      ) : null}
                      {target.grants.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {target.grants
                            .map(
                              (grant) =>
                                `${grant.roleDisplayName} · ${grant.scopeLabel}`,
                            )
                            .join("; ")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No additional organisation or site grants yet
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
              <Button
                type="submit"
                className="min-h-11 self-start"
                data-testid="ownership-choose-continue"
              >
                Continue to review
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {step === "review" && selected ? (
        <div className="flex flex-col gap-5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-medium text-foreground"
          >
            Review the ownership change
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                From
              </dt>
              <dd
                className="mt-1 text-sm text-foreground"
                data-testid="ownership-review-from"
              >
                {currentOwner
                  ? ownerIdentity(currentOwner)
                  : "Current organisation owner"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">To</dt>
              <dd
                className="mt-1 text-sm text-foreground"
                data-testid="ownership-review-to"
              >
                {ownerIdentity(selected)}
              </dd>
            </div>
          </dl>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>{selected.displayName} becomes Organisation Owner.</li>
            <li>
              The current owner loses Organisation Owner authority and remains a
              member.
            </li>
            <li>
              The current owner keeps their other explicit grants. This
              transfer does not assign site administration.
            </li>
            <li>
              Sites, billing, subscribed capacity and historical records stay
              with {organisationName}.
            </li>
          </ul>
          {currentOwner ? (
            <p className="text-sm text-muted-foreground">
              If the previous owner still needs site administration access,
              assign it through People.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => goTo("choose")}
            >
              Back
            </Button>
            <Button
              type="button"
              className="min-h-11"
              data-testid="ownership-review-continue"
              onClick={() => goTo("confirm")}
            >
              Continue to confirmation
            </Button>
          </div>
        </div>
      ) : null}

      {step === "confirm" && selected ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            executeTransfer();
          }}
        >
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-medium text-foreground"
          >
            Confirm transfer
          </h2>
          <p className="text-sm text-muted-foreground">
            Type the organisation name to transfer ownership from{" "}
            {currentOwner ? currentOwner.displayName : "the current owner"} to{" "}
            {selected.displayName}. This cannot be undone from this screen.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={confirmationId}>
              Type {organisationName} to confirm
            </Label>
            <Input
              id={confirmationId}
              name="organisationConfirmation"
              value={confirmationName}
              onChange={(event) => setConfirmationName(event.target.value)}
              autoComplete="off"
              aria-describedby={error ? errorId : undefined}
              data-testid="ownership-confirmation-input"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => goTo("review")}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-11"
              disabled={pending || !confirmationMatches}
              data-testid="ownership-confirm-transfer"
            >
              {pending ? "Transferring ownership…" : "Transfer ownership"}
            </Button>
          </div>
        </form>
      ) : null}

      {step === "complete" && selected ? (
        <div
          className="flex flex-col gap-5"
          data-testid="ownership-transfer-complete"
        >
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-medium text-foreground"
          >
            Ownership transferred successfully
          </h2>
          <p className="text-sm text-muted-foreground">
            {selected.displayName} is now the organisation owner of{" "}
            {organisationName}. You remain a member. If you still need site
            administration access, ask the new owner to assign it through
            People.
          </p>
          <Button asChild className="min-h-11 self-start">
            <AppLink
              href="/platform/settings/organisation"
              data-testid="ownership-complete-back"
            >
              Back to organisation
            </AppLink>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
