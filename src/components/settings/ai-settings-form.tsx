"use client";

import { useState } from "react";

import { AiUsageSummaryPanel } from "@/components/settings/ai-usage-summary-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AiSettingsFormProps = {
  initialEnabled: boolean;
  initialMonthlyTokenCeiling: number | null;
  initialWebSearchEnabled: boolean;
  providerAvailable: boolean;
  usageSummary: Record<string, unknown> | null;
  usageLoadError?: string | null;
  onSave: (input: {
    aiEnabled: boolean;
    monthlyTokenCeiling?: number | null;
    webSearchEnabled: boolean;
  }) => Promise<{ error?: string; ok?: true }>;
};

export function AiSettingsForm({
  initialEnabled,
  initialMonthlyTokenCeiling,
  initialWebSearchEnabled,
  providerAvailable,
  usageSummary,
  usageLoadError = null,
  onSave,
}: AiSettingsFormProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    initialWebSearchEnabled,
  );
  const [ceiling, setCeiling] = useState(
    initialMonthlyTokenCeiling?.toString() ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const result = await onSave({
      aiEnabled: enabled,
      monthlyTokenCeiling: ceiling.trim() ? Number(ceiling) : null,
      webSearchEnabled,
    });
    setMessage(result.error ?? "Settings saved.");
    setLoading(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Organisation AI</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                data-testid="ai-settings-enabled"
              />
              Enable Lean AI for this organisation
            </label>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-monthly-ceiling">
                Monthly token ceiling (optional)
              </Label>
              <Input
                id="ai-monthly-ceiling"
                data-testid="ai-settings-ceiling"
                value={ceiling}
                onChange={(event) => setCeiling(event.target.value)}
                placeholder="e.g. 500000"
              />
            </div>
            <div
              className="flex flex-col gap-2 border-t border-border pt-4"
              data-testid="ai-settings-web-search-section"
            >
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={webSearchEnabled}
                  onChange={(event) =>
                    setWebSearchEnabled(event.target.checked)
                  }
                  aria-describedby="ai-settings-web-search-help"
                  data-testid="ai-settings-web-search"
                />
                <span>Allow LeanAI to search the public web</span>
              </label>
              <p
                id="ai-settings-web-search-help"
                className="text-xs text-muted-foreground"
              >
                Allows LeanAI to use public web search when a question requires
                current or external information. Web searches may incur
                additional AI usage costs.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Provider availability:{" "}
              {providerAvailable ? "configured" : "not configured"}
            </p>
            <Button
              type="submit"
              disabled={loading}
              data-testid="ai-settings-save"
            >
              Save settings
            </Button>
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Usage this month</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <AiUsageSummaryPanel
            usageSummary={usageSummary}
            usageLoadError={usageLoadError}
          />
        </CardContent>
      </Card>
    </div>
  );
}
