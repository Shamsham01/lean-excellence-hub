"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  addMaturityCriterion,
  addMaturityLevel,
  addMaturityPillar,
  addMaturityQuestion,
  linkCriterionQuestion,
  publishMaturityModel,
  setFrameworkAssessmentScopes,
} from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MATURITY_ASSESSMENT_SCOPE_TYPES,
  scopeTypeLabel,
  type MaturityAssessmentScopeType,
} from "@/modules/maturity/semantic-scope";

const STEPS = [
  { id: "details", label: "Details" },
  { id: "scopes", label: "Assessment scope" },
  { id: "levels", label: "Levels" },
  { id: "pillars", label: "Pillars" },
  { id: "criteria", label: "Criteria" },
  { id: "questions", label: "Questions" },
  { id: "review", label: "Review" },
  { id: "publish", label: "Publish" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

type LevelRow = { level_number: number; name: string };
type PillarRow = {
  id: string;
  name: string;
  position: number;
  section_id: string;
};
type CriterionRow = {
  id: string;
  name: string;
  pillar_id: string;
  position: number;
};
type QuestionRow = { id: string; prompt: string; criterion_id: string };

type FrameworkEditorProps = {
  modelId: string;
  modelName: string;
  modelDescription: string | null;
  versionId: string;
  versionNumber: number;
  assessmentScopes: MaturityAssessmentScopeType[];
  levels: LevelRow[];
  pillars: PillarRow[];
  criteria: CriterionRow[];
  questions: QuestionRow[];
};

export function FrameworkEditor({
  modelId,
  modelName,
  modelDescription,
  versionId,
  versionNumber,
  assessmentScopes,
  levels,
  pillars,
  criteria,
  questions,
}: FrameworkEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>("details");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<
    MaturityAssessmentScopeType[]
  >(assessmentScopes.length > 0 ? assessmentScopes : ["site"]);

  async function run<T>(action: () => Promise<{ error?: string } | T>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (
      result &&
      typeof result === "object" &&
      "error" in result &&
      result.error
    ) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  const linkedQuestionCount = questions.length;
  const canPublish =
    levels.length > 0 &&
    pillars.length > 0 &&
    criteria.length > 0 &&
    linkedQuestionCount > 0;

  return (
    <Card data-testid="framework-editor">
      <CardHeader>
        <CardTitle>Draft version {versionNumber}</CardTitle>
        <nav
          className="flex flex-wrap gap-2"
          aria-label="Framework setup steps"
        >
          {STEPS.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={step === s.id ? "default" : "outline"}
              onClick={() => setStep(s.id)}
              data-testid={`framework-step-${s.id}`}
            >
              {s.label}
            </Button>
          ))}
        </nav>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {step === "details" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="font-medium">Name:</span> {modelName}
            </p>
            <p>
              <span className="font-medium">Description:</span>{" "}
              {modelDescription ?? "—"}
            </p>
            <p className="text-muted-foreground">
              Create the framework draft from the models list to set the name.
              Continue with levels and pillars.
            </p>
          </div>
        ) : null}

        {step === "scopes" ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (selectedScopes.length === 0) {
                setError("Select at least one assessment scope.");
                return;
              }
              await run(() =>
                setFrameworkAssessmentScopes(
                  versionId,
                  selectedScopes,
                  modelId,
                ),
              );
            }}
          >
            <p className="text-sm text-muted-foreground">
              Choose which semantic Lean scopes this framework supports. Site is
              the default Lean maturity assessment scope.
            </p>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Allowed scopes</legend>
              {MATURITY_ASSESSMENT_SCOPE_TYPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={(event) => {
                      setSelectedScopes((current) => {
                        if (event.target.checked) {
                          return current.includes(scope)
                            ? current
                            : [...current, scope];
                        }
                        return current.filter((item) => item !== scope);
                      });
                    }}
                  />
                  {scopeTypeLabel(scope)}
                </label>
              ))}
            </fieldset>
            <Button
              type="submit"
              disabled={busy || selectedScopes.length === 0}
            >
              Save assessment scopes
            </Button>
          </form>
        ) : null}

        {step === "levels" ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const levelNumber = Number(form.levelNumber.value);
              const name = form.levelName.value.trim();
              const color = form.levelColor.value.trim() || "maturity-1";
              if (!name) return;
              await run(() =>
                addMaturityLevel(versionId, levelNumber, name, color, modelId),
              );
              form.reset();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="levelNumber">Level number</Label>
              <Input
                id="levelNumber"
                name="levelNumber"
                type="number"
                min={1}
                required
                defaultValue={levels.length + 1}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="levelName">Level name</Label>
              <Input
                id="levelName"
                name="levelName"
                required
                placeholder="Initial"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="levelColor">Color token</Label>
              <Input
                id="levelColor"
                name="levelColor"
                placeholder="maturity-1"
              />
            </div>
            <Button type="submit" disabled={busy}>
              Add level
            </Button>
            <ul className="text-sm">
              {levels.map((l) => (
                <li key={l.level_number}>
                  {l.level_number}. {l.name}
                </li>
              ))}
            </ul>
          </form>
        ) : null}

        {step === "pillars" ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const name = form.pillarName.value.trim();
              const position = Number(form.pillarPosition.value);
              if (!name) return;
              await run(() =>
                addMaturityPillar(versionId, name, position, modelId),
              );
              form.reset();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="pillarName">Pillar name</Label>
              <Input
                id="pillarName"
                name="pillarName"
                required
                placeholder="Leadership"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pillarPosition">Position</Label>
              <Input
                id="pillarPosition"
                name="pillarPosition"
                type="number"
                min={1}
                required
                defaultValue={pillars.length + 1}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Add pillar
            </Button>
            <ul className="text-sm">
              {pillars.map((p) => (
                <li key={p.id}>
                  {p.position}. {p.name}
                </li>
              ))}
            </ul>
          </form>
        ) : null}

        {step === "criteria" ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const pillarId = form.pillarId.value;
              const name = form.criterionName.value.trim();
              const position = Number(form.criterionPosition.value);
              if (!name || !pillarId) return;
              await run(() =>
                addMaturityCriterion(pillarId, name, position, modelId),
              );
              form.reset();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="pillarId">Pillar</Label>
              <select
                id="pillarId"
                name="pillarId"
                required
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              >
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="criterionName">Criterion name</Label>
              <Input id="criterionName" name="criterionName" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="criterionPosition">Position</Label>
              <Input
                id="criterionPosition"
                name="criterionPosition"
                type="number"
                min={1}
                required
                defaultValue={1}
              />
            </div>
            <Button type="submit" disabled={busy || pillars.length === 0}>
              Add criterion
            </Button>
            <ul className="text-sm">
              {criteria.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </form>
        ) : null}

        {step === "questions" ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const criterionId = form.criterionId.value;
              const prompt = form.questionPrompt.value.trim();
              const position = Number(form.questionPosition.value);
              const pillar = pillars.find((p) =>
                criteria.some(
                  (c) => c.id === criterionId && c.pillar_id === p.id,
                ),
              );
              const criterion = criteria.find((c) => c.id === criterionId);
              if (!prompt || !criterion || !pillar) return;
              const ok = await run(async () => {
                const q = await addMaturityQuestion(
                  versionId,
                  pillar.section_id,
                  prompt,
                  position,
                  modelId,
                );
                if (q.error || !q.questionId) return q;
                return linkCriterionQuestion(
                  criterionId,
                  q.questionId,
                  modelId,
                );
              });
              if (ok) form.reset();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="criterionId">Criterion</Label>
              <select
                id="criterionId"
                name="criterionId"
                required
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              >
                {criteria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="questionPrompt">Question prompt</Label>
              <Input
                id="questionPrompt"
                name="questionPrompt"
                required
                placeholder="Rate this criterion"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="questionPosition">Position</Label>
              <Input
                id="questionPosition"
                name="questionPosition"
                type="number"
                min={1}
                required
                defaultValue={1}
              />
            </div>
            <Button type="submit" disabled={busy || criteria.length === 0}>
              Add scored question
            </Button>
            <ul className="text-sm">
              {questions.map((q) => (
                <li key={q.id}>{q.prompt}</li>
              ))}
            </ul>
          </form>
        ) : null}

        {step === "review" ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Assessment scopes</dt>
              <dd>{selectedScopes.map(scopeTypeLabel).join(", ")}</dd>
            </div>
            <div>
              <dt className="font-medium">Levels</dt>
              <dd>{levels.length}</dd>
            </div>
            <div>
              <dt className="font-medium">Pillars</dt>
              <dd>{pillars.length}</dd>
            </div>
            <div>
              <dt className="font-medium">Criteria</dt>
              <dd>{criteria.length}</dd>
            </div>
            <div>
              <dt className="font-medium">Scored questions</dt>
              <dd>{linkedQuestionCount}</dd>
            </div>
          </dl>
        ) : null}

        {step === "publish" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Publishing locks this version for assessments. Requires at least
              one level, pillar, criterion, and scored question.
            </p>
            <Button
              type="button"
              disabled={!canPublish || busy}
              data-testid="publish-framework"
              onClick={async () => {
                const ok = await run(() =>
                  publishMaturityModel(versionId, modelId),
                );
                if (ok) router.refresh();
              }}
            >
              Publish framework version
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
