"use client";

import { useMemo, useState } from "react";

import { createSkillsStandard } from "@/app/(platform)/platform/skills/actions";
import { CatalogCodeControls } from "@/components/skills/catalog-code-controls";
import { SkillsFieldError } from "@/components/skills/skills-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  generateSkillCatalogCode,
  resolveSkillCatalogCreateCode,
  resolveUniqueSkillCatalogCode,
} from "@/modules/skills/catalog-code";

export function StandardNameCreateForm({
  existingCodes,
  onCreated,
}: {
  existingCodes: readonly string[];
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoCode = useMemo(
    () =>
      resolveUniqueSkillCatalogCode(
        generateSkillCatalogCode(name),
        existingCodes,
      ),
    [existingCodes, name],
  );

  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      data-testid="standard-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting) return;
        const resolved = resolveSkillCatalogCreateCode({
          name,
          existingCodes,
          noun: "skills standard",
          ...(useCustomCode ? { customCode } : {}),
        });
        if (!resolved.ok) {
          setError(resolved.message);
          return;
        }
        setSubmitting(true);
        setError(null);
        void createSkillsStandard({
          name: name.trim(),
          code: resolved.code,
        })
          .then((result) => {
            if ("standardId" in result && result.standardId) {
              onCreated?.();
              navigateTo(`/platform/skills/standards/${result.standardId}`);
              return;
            }
            setError("error" in result ? result.error : "Unable to create standard.");
            setSubmitting(false);
          })
          .catch(() => {
            setError("Unable to create standard.");
            setSubmitting(false);
          });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="standard-name">Standard name</Label>
        <Input
          id="standard-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="min-h-11"
        />
      </div>
      <CatalogCodeControls
        noun="Standard"
        autoCode={autoCode}
        useCustomCode={useCustomCode}
        customCode={customCode}
        disabled={submitting}
        previewTestId="standard-auto-code-preview"
        toggleTestId="standard-custom-code-toggle"
        inputTestId="standard-custom-code-input"
        onCustomCodeChange={setCustomCode}
        onToggle={() => {
          setUseCustomCode((current) => {
            const next = !current;
            setCustomCode(next ? autoCode : "");
            return next;
          });
        }}
      />
      {error ? (
        <SkillsFieldError
          id="standard-create-error"
          testId="standard-create-error"
        >
          {error}
        </SkillsFieldError>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={submitting}>
        {submitting ? "Creating…" : "Create and edit requirements"}
      </Button>
    </form>
  );
}
