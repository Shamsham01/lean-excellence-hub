"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AuthoringSaveFeedback } from "@/components/authoring/authoring-save-feedback";
import { useAuthoringStep } from "@/components/authoring/use-authoring-step";

import {
  addMaturityCriterion,
  addMaturityLevel,
  addMaturityPillar,
  addMaturityQuestion,
  deleteMaturityCriterion,
  deleteMaturityQuestion,
  linkCriterionQuestion,
  moveMaturityCriterion,
  moveMaturityQuestion,
  publishMaturityModel,
  setFrameworkAssessmentScopes,
  updateMaturityCriterion,
  updateMaturityLevel,
  updateMaturityModelMetadata,
  updateMaturityPillar,
  updateMaturityQuestion,
} from "@/app/(platform)/platform/maturity/actions";
import { FrameworkStructurePreview } from "@/components/maturity/framework-structure-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  assessFrameworkPublishReadiness,
  buildFrameworkHierarchy,
  formatFrameworkStructureChangeLines,
  neighborForReorder,
  nextCriterionPositionForPillar,
  nextPillarPosition,
  nextQuestionPositionForCriterion,
  orderedByPosition,
  orderedQuestionsForCriterion,
  orderedQuestionsForPillar,
  planUniquePositionSwap,
  summarizeFrameworkStructureChanges,
  targetPositionForQuestionReparent,
} from "@/modules/maturity/framework-authoring";
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
const STEP_IDS: StepId[] = STEPS.map((step) => step.id);

type LevelRow = {
  id: string;
  level_number: number;
  name: string;
  color_token: string;
  description: string | null;
  guidance: string | null;
};
type PillarRow = {
  id: string;
  name: string;
  position: number;
  section_id: string;
  description: string | null;
  guidance: string | null;
};
type CriterionRow = {
  id: string;
  name: string;
  pillar_id: string;
  position: number;
  description: string | null;
  guidance: string | null;
};
type QuestionRow = {
  id: string;
  prompt: string;
  criterion_id: string;
  position: number;
};

type ActiveVersionReference = {
  versionNumber: number;
  pillars: PillarRow[];
  criteria: CriterionRow[];
  questions: QuestionRow[];
};

type FrameworkEditorProps = {
  modelId: string;
  modelName: string;
  modelDescription: string | null;
  versionId: string;
  versionNumber: number;
  initialAuthoringStep?: StepId;
  assessmentScopes: MaturityAssessmentScopeType[];
  levels: LevelRow[];
  pillars: PillarRow[];
  criteria: CriterionRow[];
  questions: QuestionRow[];
  activeVersion?: ActiveVersionReference | null;
};

function ReorderControls({
  label,
  canMoveUp,
  canMoveDown,
  busy,
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || !canMoveUp}
        aria-label={`${label} move up`}
        onClick={() => void onMoveUp()}
      >
        Move up
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || !canMoveDown}
        aria-label={`${label} move down`}
        onClick={() => void onMoveDown()}
      >
        Move down
      </Button>
    </div>
  );
}

function QuestionEditorCard({
  question,
  pillarName,
  criterionName,
  criteria,
  busy,
  canMoveUp,
  canMoveDown,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: QuestionRow;
  pillarName: string;
  criterionName: string;
  criteria: CriterionRow[];
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSave: (input: { prompt: string; criterionId: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
}) {
  return (
    <form
      className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2"
      data-testid={`edit-question-${question.id}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const payload = new FormData(event.currentTarget);
        await onSave({
          prompt: String(payload.get("questionPrompt") ?? "").trim(),
          criterionId: String(payload.get("questionCriterionId") ?? ""),
        });
      }}
    >
      <p className="text-xs text-muted-foreground sm:col-span-2">
        {pillarName} → {criterionName}
      </p>
      <Input
        name="questionPrompt"
        defaultValue={question.prompt}
        className="sm:col-span-2"
        aria-label="Question prompt"
      />
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Criterion</span>
        <select
          name="questionCriterionId"
          defaultValue={question.criterion_id}
          aria-label="Question criterion"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {criteria.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <ReorderControls
          label="Question"
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          busy={busy}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
        <Button type="submit" size="sm" disabled={busy}>
          Save question
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          data-testid={`delete-question-${question.id}`}
          onClick={() => void onDelete()}
        >
          Delete question
        </Button>
      </div>
    </form>
  );
}

export function FrameworkEditor({
  modelId,
  modelName,
  modelDescription,
  versionId,
  versionNumber,
  initialAuthoringStep = "details",
  assessmentScopes,
  levels,
  pillars,
  criteria,
  questions,
  activeVersion = null,
}: FrameworkEditorProps) {
  const router = useRouter();
  const [step, setStep] = useAuthoringStep(
    STEP_IDS,
    "details",
    initialAuthoringStep,
  );
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(modelName);
  const [description, setDescription] = useState(modelDescription ?? "");
  const [selectedScopes, setSelectedScopes] = useState<
    MaturityAssessmentScopeType[]
  >(assessmentScopes.length > 0 ? assessmentScopes : ["site"]);
  const [selectedCriterionId, setSelectedCriterionId] = useState(
    criteria[0]?.id ?? "",
  );
  const [selectedCriterionPillarId, setSelectedCriterionPillarId] = useState(
    criteria[0]?.pillar_id ?? pillars[0]?.id ?? "",
  );

  async function run<T>(action: () => Promise<{ error?: string } | T>) {
    setBusy(true);
    setError(null);
    setSaveMessage(null);
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
    setSaveMessage("Saved.");
    router.refresh();
    return true;
  }

  const questionHierarchy = useMemo(
    () => buildFrameworkHierarchy({ pillars, criteria, questions }),
    [criteria, pillars, questions],
  );
  const publishReadiness = useMemo(
    () =>
      assessFrameworkPublishReadiness({
        levels,
        pillars,
        criteria,
        questions,
      }),
    [criteria, levels, pillars, questions],
  );
  const structureChanges = useMemo(
    () =>
      activeVersion
        ? summarizeFrameworkStructureChanges(activeVersion, {
            pillars,
            criteria,
            questions,
          })
        : null,
    [activeVersion, criteria, pillars, questions],
  );
  const orderedPillars = useMemo(() => orderedByPosition(pillars), [pillars]);

  async function swapPillarOrder(pillar: PillarRow, direction: "up" | "down") {
    const neighbor = neighborForReorder(orderedPillars, pillar.id, direction);
    if (!neighbor) return;
    const plan = planUniquePositionSwap(pillar, neighbor, orderedPillars);
    await run(async () => {
      const staged = await updateMaturityPillar(
        pillar.id,
        pillar.name,
        plan.stagedPosition,
        pillar.description,
        pillar.guidance,
        modelId,
      );
      if (
        staged &&
        typeof staged === "object" &&
        "error" in staged &&
        staged.error
      ) {
        return staged;
      }
      const neighborMoved = await updateMaturityPillar(
        neighbor.id,
        neighbor.name,
        plan.neighborFinalPosition,
        neighbor.description,
        neighbor.guidance,
        modelId,
      );
      if (
        neighborMoved &&
        typeof neighborMoved === "object" &&
        "error" in neighborMoved &&
        neighborMoved.error
      ) {
        return neighborMoved;
      }
      return updateMaturityPillar(
        pillar.id,
        pillar.name,
        plan.itemFinalPosition,
        pillar.description,
        pillar.guidance,
        modelId,
      );
    });
  }

  async function swapCriterionOrder(
    criterion: CriterionRow,
    direction: "up" | "down",
  ) {
    const siblings = criteria.filter(
      (entry) => entry.pillar_id === criterion.pillar_id,
    );
    const neighbor = neighborForReorder(siblings, criterion.id, direction);
    if (!neighbor) return;
    const plan = planUniquePositionSwap(criterion, neighbor, siblings);
    await run(async () => {
      const staged = await updateMaturityCriterion(
        criterion.id,
        criterion.name,
        plan.stagedPosition,
        criterion.description,
        criterion.guidance,
        modelId,
      );
      if (
        staged &&
        typeof staged === "object" &&
        "error" in staged &&
        staged.error
      ) {
        return staged;
      }
      const neighborMoved = await updateMaturityCriterion(
        neighbor.id,
        neighbor.name,
        plan.neighborFinalPosition,
        neighbor.description,
        neighbor.guidance,
        modelId,
      );
      if (
        neighborMoved &&
        typeof neighborMoved === "object" &&
        "error" in neighborMoved &&
        neighborMoved.error
      ) {
        return neighborMoved;
      }
      return updateMaturityCriterion(
        criterion.id,
        criterion.name,
        plan.itemFinalPosition,
        criterion.description,
        criterion.guidance,
        modelId,
      );
    });
  }

  async function swapQuestionOrder(
    question: QuestionRow,
    pillarId: string,
    direction: "up" | "down",
  ) {
    const criterionSiblings = orderedQuestionsForCriterion(
      question.criterion_id,
      questions,
    );
    const neighbor = neighborForReorder(
      criterionSiblings,
      question.id,
      direction,
    );
    if (!neighbor) return;
    const pillarQuestions = orderedQuestionsForPillar(
      pillarId,
      pillars,
      criteria,
      questions,
    );
    const plan = planUniquePositionSwap(question, neighbor, pillarQuestions);
    await run(async () => {
      const staged = await updateMaturityQuestion(
        question.id,
        question.prompt,
        plan.stagedPosition,
        modelId,
      );
      if (
        staged &&
        typeof staged === "object" &&
        "error" in staged &&
        staged.error
      ) {
        return staged;
      }
      const neighborMoved = await updateMaturityQuestion(
        neighbor.id,
        neighbor.prompt,
        plan.neighborFinalPosition,
        modelId,
      );
      if (
        neighborMoved &&
        typeof neighborMoved === "object" &&
        "error" in neighborMoved &&
        neighborMoved.error
      ) {
        return neighborMoved;
      }
      return updateMaturityQuestion(
        question.id,
        question.prompt,
        plan.itemFinalPosition,
        modelId,
      );
    });
  }

  async function saveQuestion(
    question: QuestionRow,
    input: {
      prompt: string;
      criterionId: string;
    },
  ) {
    if (input.criterionId !== question.criterion_id) {
      const targetPosition = targetPositionForQuestionReparent({
        sourceCriterionId: question.criterion_id,
        destinationCriterionId: input.criterionId,
        pillars,
        criteria,
        questions,
      });
      await run(() =>
        moveMaturityQuestion(
          question.id,
          input.criterionId,
          targetPosition,
          modelId,
        ),
      );
      return;
    }
    await run(() =>
      updateMaturityQuestion(
        question.id,
        input.prompt,
        question.position,
        modelId,
      ),
    );
  }

  async function removeQuestion(question: QuestionRow) {
    const confirmed = window.confirm(
      `Delete question “${question.prompt}” from this draft? This cannot be undone.`,
    );
    if (!confirmed) return;
    await run(() => deleteMaturityQuestion(question.id, modelId));
  }

  return (
    <Card data-testid="framework-editor">
      <CardHeader>
        <CardTitle data-testid="draft-version-heading">
          Draft version {versionNumber} — Editing
        </CardTitle>
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
        <AuthoringSaveFeedback message={saveMessage} />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {step === "details" ? (
          <form
            className="flex max-w-md flex-col gap-3"
            data-testid="framework-details-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmedName = name.trim();
              if (!trimmedName) {
                setError("Name is required");
                return;
              }
              await run(() =>
                updateMaturityModelMetadata(
                  versionId,
                  trimmedName,
                  description.trim() || null,
                  modelId,
                ),
              );
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="frameworkName">Display name</Label>
              <Input
                id="frameworkName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="frameworkDescription">Description</Label>
              <Input
                id="frameworkDescription"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Save framework details
            </Button>
          </form>
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
          <div className="flex flex-col gap-6">
            <form
              className="flex max-w-md flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const levelNumber = Number(form.levelNumber.value);
                const levelName = form.levelName.value.trim();
                const color = form.levelColor.value.trim() || "maturity-1";
                if (!levelName) return;
                await run(() =>
                  addMaturityLevel(
                    versionId,
                    levelNumber,
                    levelName,
                    color,
                    modelId,
                  ),
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
            </form>
            <div className="flex flex-col gap-3">
              {levels.map((level) => (
                <form
                  key={level.id}
                  className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2"
                  data-testid={`edit-level-${level.level_number}`}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    await run(() =>
                      updateMaturityLevel(
                        level.id,
                        Number(form.levelNumber.value),
                        form.levelName.value.trim(),
                        form.levelColor.value.trim() || "maturity-1",
                        form.levelDescription.value.trim() || null,
                        form.levelGuidance.value.trim() || null,
                        modelId,
                      ),
                    );
                  }}
                >
                  <Input
                    name="levelNumber"
                    type="number"
                    min={1}
                    defaultValue={level.level_number}
                    aria-label="Level number"
                  />
                  <Input
                    name="levelName"
                    defaultValue={level.name}
                    aria-label="Level name"
                  />
                  <Input
                    name="levelColor"
                    defaultValue={level.color_token}
                    aria-label="Color token"
                  />
                  <Input
                    name="levelDescription"
                    defaultValue={level.description ?? ""}
                    placeholder="Description"
                    aria-label="Level description"
                  />
                  <Input
                    name="levelGuidance"
                    defaultValue={level.guidance ?? ""}
                    placeholder="Guidance"
                    className="sm:col-span-2"
                    aria-label="Level guidance"
                  />
                  <Button type="submit" size="sm" disabled={busy}>
                    Save level
                  </Button>
                </form>
              ))}
            </div>
          </div>
        ) : null}

        {step === "pillars" ? (
          <div className="flex flex-col gap-6">
            <form
              className="flex max-w-md flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const pillarName = form.pillarName.value.trim();
                if (!pillarName) return;
                await run(() =>
                  addMaturityPillar(
                    versionId,
                    pillarName,
                    nextPillarPosition(pillars),
                    modelId,
                  ),
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
              <Button type="submit" disabled={busy}>
                Add pillar
              </Button>
            </form>
            <div className="flex flex-col gap-3">
              {orderedPillars.map((pillar) => (
                <form
                  key={pillar.id}
                  className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2"
                  data-testid={`edit-pillar-${pillar.position}`}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    await run(() =>
                      updateMaturityPillar(
                        pillar.id,
                        form.pillarName.value.trim(),
                        pillar.position,
                        form.pillarDescription.value.trim() || null,
                        form.pillarGuidance.value.trim() || null,
                        modelId,
                      ),
                    );
                  }}
                >
                  <Input
                    name="pillarName"
                    defaultValue={pillar.name}
                    aria-label="Pillar name"
                  />
                  <Input
                    name="pillarDescription"
                    defaultValue={pillar.description ?? ""}
                    placeholder="Description"
                    aria-label="Pillar description"
                  />
                  <Input
                    name="pillarGuidance"
                    defaultValue={pillar.guidance ?? ""}
                    placeholder="Guidance"
                    aria-label="Pillar guidance"
                  />
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <ReorderControls
                      label="Pillar"
                      canMoveUp={
                        neighborForReorder(orderedPillars, pillar.id, "up") !=
                        null
                      }
                      canMoveDown={
                        neighborForReorder(orderedPillars, pillar.id, "down") !=
                        null
                      }
                      busy={busy}
                      onMoveUp={() => swapPillarOrder(pillar, "up")}
                      onMoveDown={() => swapPillarOrder(pillar, "down")}
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      Save pillar
                    </Button>
                  </div>
                </form>
              ))}
            </div>
          </div>
        ) : null}

        {step === "criteria" ? (
          <div className="flex flex-col gap-6">
            <form
              className="flex max-w-md flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const pillarId = form.pillarId.value;
                const criterionName = form.criterionName.value.trim();
                if (!criterionName || !pillarId) return;
                await run(() =>
                  addMaturityCriterion(
                    pillarId,
                    criterionName,
                    nextCriterionPositionForPillar(pillarId, criteria),
                    modelId,
                  ),
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
                  value={selectedCriterionPillarId}
                  onChange={(event) =>
                    setSelectedCriterionPillarId(event.target.value)
                  }
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
              <Button type="submit" disabled={busy || pillars.length === 0}>
                Add criterion
              </Button>
            </form>
            <div className="flex flex-col gap-3">
              {criteria.map((criterion) => {
                const pillarName =
                  pillars.find((pillar) => pillar.id === criterion.pillar_id)
                    ?.name ?? "Unknown pillar";
                const questionCount = questions.filter(
                  (question) => question.criterion_id === criterion.id,
                ).length;
                return (
                  <form
                    key={criterion.id}
                    className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2"
                    data-testid={`edit-criterion-${criterion.id}`}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const payload = new FormData(form);
                      const nextPillarId = String(
                        payload.get("criterionPillarId") ?? "",
                      );
                      if (nextPillarId !== criterion.pillar_id) {
                        await run(() =>
                          moveMaturityCriterion(
                            criterion.id,
                            nextPillarId,
                            undefined,
                            modelId,
                          ),
                        );
                        return;
                      }
                      await run(() =>
                        updateMaturityCriterion(
                          criterion.id,
                          String(payload.get("criterionName") ?? "").trim(),
                          criterion.position,
                          String(
                            payload.get("criterionDescription") ?? "",
                          ).trim() || null,
                          String(
                            payload.get("criterionGuidance") ?? "",
                          ).trim() || null,
                          modelId,
                        ),
                      );
                    }}
                  >
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      {pillarName}
                    </p>
                    <Input
                      name="criterionName"
                      defaultValue={criterion.name}
                      aria-label="Criterion name"
                    />
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-muted-foreground">Pillar</span>
                      <select
                        name="criterionPillarId"
                        defaultValue={criterion.pillar_id}
                        aria-label="Criterion pillar"
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                      >
                        {pillars.map((pillar) => (
                          <option key={pillar.id} value={pillar.id}>
                            {pillar.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      name="criterionDescription"
                      defaultValue={criterion.description ?? ""}
                      placeholder="Description"
                      aria-label="Criterion description"
                    />
                    <Input
                      name="criterionGuidance"
                      defaultValue={criterion.guidance ?? ""}
                      placeholder="Guidance"
                      aria-label="Criterion guidance"
                      className="sm:col-span-2"
                    />
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <ReorderControls
                        label="Criterion"
                        canMoveUp={
                          neighborForReorder(
                            criteria.filter(
                              (entry) =>
                                entry.pillar_id === criterion.pillar_id,
                            ),
                            criterion.id,
                            "up",
                          ) != null
                        }
                        canMoveDown={
                          neighborForReorder(
                            criteria.filter(
                              (entry) =>
                                entry.pillar_id === criterion.pillar_id,
                            ),
                            criterion.id,
                            "down",
                          ) != null
                        }
                        busy={busy}
                        onMoveUp={() => swapCriterionOrder(criterion, "up")}
                        onMoveDown={() => swapCriterionOrder(criterion, "down")}
                      />
                      <Button type="submit" size="sm" disabled={busy}>
                        Save criterion
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        data-testid={`delete-criterion-${criterion.id}`}
                        onClick={async () => {
                          const confirmed = window.confirm(
                            questionCount > 0
                              ? `Delete criterion “${criterion.name}” and its ${questionCount} question(s) from this draft? This cannot be undone.`
                              : `Delete criterion “${criterion.name}” from this draft? This cannot be undone.`,
                          );
                          if (!confirmed) return;
                          await run(() =>
                            deleteMaturityCriterion(criterion.id, modelId),
                          );
                        }}
                      >
                        Delete criterion
                      </Button>
                    </div>
                  </form>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "questions" ? (
          <div className="flex flex-col gap-6">
            <form
              className="flex max-w-md flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const criterionId = form.criterionId.value;
                const prompt = form.questionPrompt.value.trim();
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
                    nextQuestionPositionForCriterion(
                      criterionId,
                      pillars,
                      criteria,
                      questions,
                    ),
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
                  value={selectedCriterionId}
                  onChange={(event) =>
                    setSelectedCriterionId(event.target.value)
                  }
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
              <Button type="submit" disabled={busy || criteria.length === 0}>
                Add scored question
              </Button>
            </form>
            <div
              className="flex flex-col gap-4"
              data-testid="question-authoring-hierarchy"
            >
              {questionHierarchy.pillars.map((pillar) => (
                <section
                  key={pillar.id}
                  className="flex flex-col gap-3 rounded-md border border-border p-4"
                  data-testid={`question-pillar-${pillar.id}`}
                >
                  <h3 className="font-medium">
                    {pillar.position}. {pillar.name}
                  </h3>
                  {pillar.criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="flex flex-col gap-3 pl-3"
                      data-testid={`question-criterion-${criterion.id}`}
                    >
                      <p className="text-sm font-medium">
                        {criterion.position}. {criterion.name}
                      </p>
                      {criterion.questions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No scored questions linked.
                        </p>
                      ) : (
                        criterion.questions.map((question) => {
                          const criterionQuestions =
                            orderedQuestionsForCriterion(
                              criterion.id,
                              questions,
                            );
                          return (
                            <QuestionEditorCard
                              key={question.id}
                              question={question}
                              pillarName={pillar.name}
                              criterionName={criterion.name}
                              criteria={criteria}
                              busy={busy}
                              canMoveUp={
                                neighborForReorder(
                                  criterionQuestions,
                                  question.id,
                                  "up",
                                ) != null
                              }
                              canMoveDown={
                                neighborForReorder(
                                  criterionQuestions,
                                  question.id,
                                  "down",
                                ) != null
                              }
                              onSave={(input) => saveQuestion(question, input)}
                              onDelete={() => removeQuestion(question)}
                              onMoveUp={() =>
                                swapQuestionOrder(question, pillar.id, "up")
                              }
                              onMoveDown={() =>
                                swapQuestionOrder(question, pillar.id, "down")
                              }
                            />
                          );
                        })
                      )}
                    </div>
                  ))}
                  {pillar.criteria.length === 0 ? (
                    <p className="pl-3 text-sm text-muted-foreground">
                      No criteria configured.
                    </p>
                  ) : null}
                </section>
              ))}
              {questionHierarchy.unlinkedQuestions.map((question) => (
                <QuestionEditorCard
                  key={question.id}
                  question={question}
                  pillarName="Unknown pillar"
                  criterionName="Unknown criterion"
                  criteria={criteria}
                  busy={busy}
                  canMoveUp={false}
                  canMoveDown={false}
                  onSave={(input) => saveQuestion(question, input)}
                  onDelete={() => removeQuestion(question)}
                  onMoveUp={async () => {}}
                  onMoveDown={async () => {}}
                />
              ))}
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <div
            className="flex flex-col gap-6"
            data-testid="framework-draft-review"
          >
            <FrameworkStructurePreview
              mode="draft"
              versionNumber={versionNumber}
              displayName={name}
              assessmentScopeLabels={selectedScopes.map(scopeTypeLabel)}
              levels={levels}
              pillars={pillars}
              criteria={criteria}
              questions={questions}
              testId="draft-structure-preview"
            />
            {activeVersion && structureChanges ? (
              <section data-testid="draft-change-summary">
                <h3 className="font-medium text-foreground">
                  Changes from Active v{activeVersion.versionNumber}
                </h3>
                <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                  {formatFrameworkStructureChangeLines(structureChanges).map(
                    (line) => (
                      <li key={line}>{line}</li>
                    ),
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {step === "publish" ? (
          <div
            className="flex flex-col gap-3"
            data-testid="framework-publish-step"
          >
            <p className="text-sm text-muted-foreground">
              {activeVersion
                ? `Publishing makes Draft version ${versionNumber} the active immutable version and archives the previously published version. Historical assessments remain pinned to their original version.`
                : `Publishing makes Draft version ${versionNumber} the active immutable version. Historical assessments remain pinned to the version they were started against.`}
            </p>
            <p className="text-sm text-muted-foreground">
              Every criterion must have at least one scored question with a
              prompt.
            </p>
            <dl
              className="grid gap-2 text-sm sm:grid-cols-2"
              data-testid="framework-publish-summary"
            >
              <div>
                <dt className="font-medium">Draft version</dt>
                <dd>{versionNumber}</dd>
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
                <dd>{questions.length}</dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="outline"
              data-testid="review-structure"
              onClick={() => setStep("review")}
            >
              Review structure
            </Button>
            {!publishReadiness.ready ? (
              <ul
                className="list-disc pl-5 text-sm text-destructive"
                data-testid="framework-publish-blockers"
              >
                {publishReadiness.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              disabled={!publishReadiness.ready || busy}
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
