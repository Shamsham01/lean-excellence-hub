"use client";

import { useMemo, useState } from "react";

import { createSkillsStandard } from "@/app/(platform)/platform/skills/actions";
import { CatalogCodeControls } from "@/components/skills/catalog-code-controls";
import { SkillsFieldError } from "@/components/skills/skills-field";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  generateSkillCatalogCode,
  resolveSkillCatalogCreateCode,
  resolveUniqueSkillCatalogCode,
} from "@/modules/skills/catalog-code";

export function StandardCreateForm({
  existingCodes,
}: {
  existingCodes: readonly string[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
        if (submitting) {
          return;
        }

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
          ...(description.trim() ? { description: description.trim() } : {}),
        })
          .then((result) => {
            if ("standardId" in result) {
              navigateTo(`/platform/skills/standards/${result.standardId}`);
              return;
            }

            setError(result.error);
            setSubmitting(false);
          })
          .catch(() => {
            setError("Unable to create this skills standard.");
            setSubmitting(false);
          });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="standard-name">Skills standard name</Label>
        <Input
          id="standard-name"
          name="name"
          required
          maxLength={160}
          value={name}
          placeholder="Production operator skills"
          onChange={(event) => setName(event.target.value)}
          data-testid="standard-name-input"
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="standard-description">
          Description <span className="font-normal">(optional)</span>
        </Label>
        <Textarea
          id="standard-description"
          rows={3}
          maxLength={2000}
          value={description}
          placeholder="Who this standard applies to, and why."
          onChange={(event) => setDescription(event.target.value)}
          data-testid="standard-description-input"
        />
      </div>
      {error ? (
        <SkillsFieldError testId="standard-create-error">
          {error}
        </SkillsFieldError>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={submitting}
          data-testid="standard-create-submit"
        >
          {submitting ? "Creating standard…" : "Create standard"}
        </Button>
        <Button variant="outline" asChild>
          <AppLink href="/platform/skills/standards">Cancel</AppLink>
        </Button>
      </div>
    </form>
  );
}
