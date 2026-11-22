"use client";

import { useState } from "react";

import { AiUsageSummaryPanel } from "@/components/settings/ai-usage-summary-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMonthlyTokenCeiling } from "@/lib/ai/organisation-ai-settings";
import type { LeanAiCustomerInclusion } from "@/modules/billing/leanai-inclusion";

type AiSettingsFormProps = {
  inclusion: LeanAiCustomerInclusion;
  siteQuantity?: number | null;
  initialEnabled: boolean;
  initialMonthlyTokenCeiling: number | null;
  initialWebSearchEnabled: boolean;
  usageSummary: Record<string, unknown> | null;
  usageLoadError?: string | null;
  onSave: (input: {
    aiEnabled: boolean;
    monthlyTokenCeiling: number | null;
    webSearchEnabled: boolean;
  }) => Promise<{ error?: string; ok?: true }>;
};

const ACKNOWLEDGEMENT =
  "I understand that reaching this count pauses new LeanAI interactions for the organisation. Other LEH workflows continue.";

export function AiSettingsForm({
  inclusion,
  siteQuantity = null,
  initialEnabled,
  initialMonthlyTokenCeiling,
  initialWebSearchEnabled,
  usageSummary,
  usageLoadError = null,
  onSave,
}: AiSettingsFormProps) {
  const hadCeiling = initialMonthlyTokenCeiling !== null;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    initialWebSearchEnabled,
  );
  const [advancedOpen, setAdvancedOpen] = useState(hadCeiling);
  const [pauseEnabled, setPauseEnabled] = useState(hadCeiling);
  const [ceiling, setCeiling] = useState(
    initialMonthlyTokenCeiling?.toString() ?? "",
  );
  const [acknowledged, setAcknowledged] = useState(hadCeiling);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"status" | "error">("status");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    let monthlyTokenCeiling: number | null = null;

    if (pauseEnabled) {
      const parsedCeiling = parseMonthlyTokenCeiling(ceiling);
      if (parsedCeiling === null || parsedCeiling === "invalid") {
        setMessageTone("error");
        setMessage(
          "Enter a whole number greater than zero to pause new LeanAI interactions.",
        );
        setAdvancedOpen(true);
        return;
      }

      if (!hadCeiling && !acknowledged) {
        setMessageTone("error");
        setMessage(
          "Confirm that reaching this count pauses new LeanAI interactions. Other LEH workflows continue.",
        );
        setAdvancedOpen(true);
        return;
      }

      monthlyTokenCeiling = parsedCeiling;
    }

    setLoading(true);
    const result = await onSave({
      aiEnabled: enabled,
      monthlyTokenCeiling,
      webSearchEnabled,
    });
    setMessageTone(result.error ? "error" : "status");
    setMessage(result.error ?? "Settings saved.");
    setLoading(false);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section
        className="flex flex-col gap-2 border-b border-border pb-6"
        data-testid="ai-settings-inclusion"
      >
        <p
          className="text-sm font-medium text-foreground"
          data-testid="ai-settings-plan"
        >
          {inclusion.planLabel}
        </p>
        <p className="text-sm text-foreground">{inclusion.statement}</p>
        <p className="text-sm text-muted-foreground">{inclusion.siteNote}</p>
        {typeof siteQuantity === "number" && siteQuantity > 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="ai-settings-site-quantity"
          >
            Subscribed sites: {siteQuantity.toLocaleString("en-GB")}. Site
            quantity scales the LEH subscription. It is not a LeanAI quota.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="typography-section-title">This month</h2>
          <p className="text-sm text-muted-foreground">
            Interactions are the shared organisation total. Model detail is
            there when you need to see how the work was done.
          </p>
        </div>
        <AiUsageSummaryPanel
          usageSummary={usageSummary}
          usageLoadError={usageLoadError}
          governanceCeiling={initialMonthlyTokenCeiling}
        />
      </section>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <section className="flex flex-col gap-3">
          <h2 className="typography-section-title">Availability</h2>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              data-testid="ai-settings-enabled"
            />
            <span>
              <span className="font-medium">
                Allow LeanAI interactions in this organisation
              </span>
              <span className="mt-1 block text-muted-foreground">
                Turning this off stops new LeanAI interactions. Problem solving,
                actions, audits, and other LEH work continue.
              </span>
            </span>
          </label>
        </section>

        <section
          className="flex flex-col gap-2 border-t border-border pt-6"
          data-testid="ai-settings-web-search-section"
        >
          <h2 className="typography-section-title">Public web research</h2>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={webSearchEnabled}
              onChange={(event) => setWebSearchEnabled(event.target.checked)}
              aria-describedby="ai-settings-web-search-help"
              data-testid="ai-settings-web-search"
            />
            <span className="font-medium">
              Allow LeanAI to search the public web
            </span>
          </label>
          <p
            id="ai-settings-web-search-help"
            className="text-sm text-muted-foreground"
          >
            LeanAI can look up public web pages when a question needs current or
            external information. Pages found on the web are untrusted and are
            not instructions. This does not add a charge to the subscription.
          </p>
        </section>

        <section className="border-t border-border pt-6">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between text-left text-sm font-medium"
            aria-expanded={advancedOpen}
            aria-controls="ai-settings-governance"
            data-testid="ai-settings-advanced-toggle"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            Advanced governance
            <span className="text-muted-foreground">
              {advancedOpen ? "Hide" : "Show"}
            </span>
          </button>
          {advancedOpen ? (
            <div
              id="ai-settings-governance"
              className="mt-3 flex flex-col gap-3"
              data-testid="ai-settings-governance"
            >
              <p className="text-sm text-muted-foreground">
                Leave this off unless the organisation wants a hard stop. There
                is no monthly ceiling until an administrator sets one here.
                Reaching it pauses new LeanAI interactions only. It does not
                stop other LEH workflows and it does not create an invoice.
              </p>
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={pauseEnabled}
                  onChange={(event) => setPauseEnabled(event.target.checked)}
                  data-testid="ai-settings-ceiling-enabled"
                />
                <span className="font-medium">
                  Pause new LeanAI interactions after a token count
                </span>
              </label>
              {pauseEnabled ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ai-monthly-ceiling">
                      Pause after this many tokens
                    </Label>
                    <Input
                      id="ai-monthly-ceiling"
                      data-testid="ai-settings-ceiling"
                      inputMode="numeric"
                      value={ceiling}
                      onChange={(event) => setCeiling(event.target.value)}
                      placeholder="Whole number"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    To resume LeanAI after a pause, raise this number or turn
                    the pause off and save. Earlier usage stays on record. Other
                    LEH workflows are unchanged throughout.
                  </p>
                  {hadCeiling ? null : (
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={acknowledged}
                        onChange={(event) =>
                          setAcknowledged(event.target.checked)
                        }
                        data-testid="ai-settings-ceiling-acknowledge"
                      />
                      <span>{ACKNOWLEDGEMENT}</span>
                    </label>
                  )}
                </div>
              ) : hadCeiling ? (
                <p className="text-sm text-muted-foreground">
                  Saving with the pause off clears the existing limit. New
                  LeanAI interactions can start again. Usage history stays.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            disabled={loading}
            data-testid="ai-settings-save"
          >
            Save settings
          </Button>
          {message ? (
            <p
              className={
                messageTone === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
              role={messageTone === "error" ? "alert" : "status"}
              data-testid="ai-settings-message"
            >
              {message}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
