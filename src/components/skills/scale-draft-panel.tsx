"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addProficiencyLevel,
  publishProficiencyScale,
} from "@/app/(platform)/platform/skills/actions";
import { SkillsFieldError } from "@/components/skills/skills-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { proficiencyScalePublishIssues } from "@/modules/skills/validation";

type SavedLevel = {
  id: string;
  order: number;
  label: string;
  description: string | null;
  guidance: string | null;
};

export function ScaleDraftPanel({
  versionId,
  scaleName,
  levels,
}: {
  versionId: string;
  scaleName: string;
  levels: SavedLevel[];
}) {
  const router = useRouter();
  const nextOrder =
    levels.reduce((max, level) => Math.max(max, level.order), 0) + 1;
  const [order, setOrder] = useState(nextOrder);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "publish" | null>(null);

  const issues = proficiencyScalePublishIssues({
    name: scaleName,
    levels: levels.map((level) => ({ order: level.order, label: level.label })),
  });

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="typography-section-title">Saved levels</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Saved levels stay on this draft. This version cannot edit or remove
          them. Add another level below if the scale is still incomplete.
        </p>
        {levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No levels saved yet.</p>
        ) : (
          <ol className="flex flex-col gap-3" data-testid="scale-saved-levels">
            {levels.map((level) => (
              <li key={level.id} className="border-t border-border pt-3">
                <p className="text-sm font-medium">
                  {level.order} — {level.label}
                </p>
                {level.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {level.description}
                  </p>
                ) : null}
                {level.guidance ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Guidance: {level.guidance}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <form
        className="flex min-w-0 flex-col gap-4"
        data-testid="scale-add-level-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) {
            return;
          }

          setPending("save");
          setError(null);
          setFeedback(null);
          void addProficiencyLevel({
            scaleVersionId: versionId,
            order,
            label,
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(guidance.trim() ? { guidance: guidance.trim() } : {}),
          })
            .then((result) => {
              if ("error" in result) {
                setError(result.error);
                setPending(null);
                return;
              }

              setLabel("");
              setDescription("");
              setGuidance("");
              setOrder((current) => current + 1);
              setFeedback("Level saved.");
              setPending(null);
              router.refresh();
            })
            .catch(() => {
              setError("Unable to add this level.");
              setPending(null);
            });
        }}
      >
        <h2 className="typography-section-title">Add a level</h2>
        <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="draft-level-order">Order</Label>
            <Input
              id="draft-level-order"
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              required
              value={order}
              onChange={(event) => setOrder(Number(event.target.value))}
              data-testid="draft-level-order"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="draft-level-label">Label</Label>
            <Input
              id="draft-level-label"
              required
              maxLength={120}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              data-testid="draft-level-label"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="draft-level-description">
            Description <span className="font-normal">(optional)</span>
          </Label>
          <Textarea
            id="draft-level-description"
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            data-testid="draft-level-description"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="draft-level-guidance">
            Guidance <span className="font-normal">(optional)</span>
          </Label>
          <Textarea
            id="draft-level-guidance"
            rows={2}
            maxLength={2000}
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            data-testid="draft-level-guidance"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={pending !== null}
          data-testid="draft-level-save"
        >
          {pending === "save" ? "Saving level…" : "Save level"}
        </Button>
      </form>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="typography-section-title">Publish</h2>
        {issues.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            This draft has a name and at least two labelled levels. Publishing
            makes it available for capability requirements and assessments.
          </p>
        )}
        <Button
          type="button"
          className="self-start"
          disabled={pending !== null || issues.length > 0}
          data-testid="scale-publish"
          onClick={() => {
            setPending("publish");
            setError(null);
            setFeedback(null);
            void publishProficiencyScale({ versionId })
              .then((result) => {
                if ("error" in result) {
                  setError(result.error);
                  setPending(null);
                  return;
                }

                setFeedback("Proficiency scale published.");
                setPending(null);
                router.refresh();
              })
              .catch(() => {
                setError("Unable to publish this proficiency scale.");
                setPending(null);
              });
          }}
        >
          {pending === "publish" ? "Publishing…" : "Publish scale"}
        </Button>
      </section>

      {error ? <SkillsFieldError>{error}</SkillsFieldError> : null}
      {feedback ? (
        <p
          className="text-sm text-foreground"
          data-testid="skills-authoring-feedback"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
