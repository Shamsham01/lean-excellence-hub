"use client";

import { useMemo, useState } from "react";

import { createSkill } from "@/app/(platform)/platform/skills/actions";
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

export function SkillCreateForm({
  existingCodes,
  scaleHref,
  hasPublishedScale,
}: {
  existingCodes: readonly string[];
  scaleHref: string;
  hasPublishedScale: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
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
      data-testid="skill-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting) {
          return;
        }

        const resolved = resolveSkillCatalogCreateCode({
          name,
          existingCodes,
          noun: "skill",
          ...(useCustomCode ? { customCode } : {}),
        });

        if (!resolved.ok) {
          setError(resolved.message);
          return;
        }

        setSubmitting(true);
        setError(null);
        void createSkill({
          name: name.trim(),
          code: resolved.code,
          ...(category.trim() ? { category: category.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(evidence.trim() ? { evidenceExpectations: evidence.trim() } : {}),
        })
          .then((result) => {
            if ("skillId" in result) {
              navigateTo(`/platform/skills/${result.skillId}`);
              return;
            }

            setError(result.error);
            setSubmitting(false);
          })
          .catch(() => {
            setError("Unable to create this skill.");
            setSubmitting(false);
          });
      }}
    >
      {!hasPublishedScale ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="skill-scale-guidance"
        >
          Publish a proficiency scale before assigning required levels. You can
          name this skill now, or{" "}
          <AppLink href={scaleHref} className="text-primary hover:underline">
            set up the scale first
          </AppLink>
          .
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="skill-name">Skill name</Label>
        <Input
          id="skill-name"
          name="name"
          required
          maxLength={160}
          value={name}
          placeholder="Forklift operation"
          onChange={(event) => setName(event.target.value)}
          data-testid="skill-name-input"
        />
      </div>
      <CatalogCodeControls
        noun="Skill"
        autoCode={autoCode}
        useCustomCode={useCustomCode}
        customCode={customCode}
        disabled={submitting}
        previewTestId="skill-auto-code-preview"
        toggleTestId="skill-custom-code-toggle"
        inputTestId="skill-custom-code-input"
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
        <Label htmlFor="skill-category">
          Category <span className="font-normal">(optional)</span>
        </Label>
        <Input
          id="skill-category"
          name="category"
          maxLength={120}
          value={category}
          placeholder="Operations"
          onChange={(event) => setCategory(event.target.value)}
          data-testid="skill-category-input"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="skill-description">
          Description <span className="font-normal">(optional)</span>
        </Label>
        <Textarea
          id="skill-description"
          name="description"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          data-testid="skill-description-input"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="skill-evidence">
          Evidence expectations <span className="font-normal">(optional)</span>
        </Label>
        <Textarea
          id="skill-evidence"
          name="evidence"
          rows={3}
          maxLength={2000}
          value={evidence}
          placeholder="Practical observation on the line."
          onChange={(event) => setEvidence(event.target.value)}
          data-testid="skill-evidence-input"
        />
      </div>
      {error ? (
        <SkillsFieldError id="skill-create-error" testId="skill-create-error">
          {error}
        </SkillsFieldError>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={submitting}
          data-testid="skill-create-submit"
        >
          {submitting ? "Creating skill…" : "Create skill"}
        </Button>
        <Button variant="outline" asChild>
          <AppLink href="/platform/skills/catalog">Cancel</AppLink>
        </Button>
      </div>
    </form>
  );
}
