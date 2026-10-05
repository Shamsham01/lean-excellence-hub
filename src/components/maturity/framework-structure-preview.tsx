import {
  buildFrameworkHierarchy,
  hierarchyDisplayLabel,
} from "@/modules/maturity/framework-authoring";
import type {
  MaturityAuthoringCriterion,
  MaturityAuthoringPillar,
  MaturityAuthoringQuestion,
} from "@/modules/maturity/framework-authoring";

type PreviewLevel = {
  id: string;
  level_number: number;
  name: string;
};

type FrameworkStructurePreviewProps = {
  mode: "published" | "draft";
  versionNumber: number;
  levels: PreviewLevel[];
  pillars: MaturityAuthoringPillar[];
  criteria: MaturityAuthoringCriterion[];
  questions: MaturityAuthoringQuestion[];
  displayName?: string;
  assessmentScopeLabels?: string[];
  testId?: string;
};

export function FrameworkStructurePreview({
  mode,
  versionNumber,
  levels,
  pillars,
  criteria,
  questions,
  displayName,
  assessmentScopeLabels,
  testId = "framework-structure-preview",
}: FrameworkStructurePreviewProps) {
  const hierarchy = buildFrameworkHierarchy({ pillars, criteria, questions });
  const sortedLevels = [...levels].sort(
    (left, right) =>
      left.level_number - right.level_number || left.id.localeCompare(right.id),
  );

  return (
    <div
      className="flex flex-col gap-6 text-sm"
      data-testid={testId}
      data-preview-mode={mode}
    >
      {mode === "draft" ? (
        <div className="flex flex-col gap-1">
          <h3
            className="text-base font-semibold text-foreground"
            data-testid="draft-version-preview-heading"
          >
            Draft version {versionNumber} preview
          </h3>
          <p className="text-muted-foreground">
            This is the structure that will become published if you publish this
            draft.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Version {versionNumber} is immutable. Use Create new version to
          correct structure without altering assessments tied to this version.
        </p>
      )}

      <dl className="grid gap-2 sm:grid-cols-2">
        {displayName ? (
          <div>
            <dt className="font-medium text-foreground">Display name</dt>
            <dd>{displayName}</dd>
          </div>
        ) : null}
        {assessmentScopeLabels ? (
          <div>
            <dt className="font-medium text-foreground">Assessment scopes</dt>
            <dd>
              {assessmentScopeLabels.length > 0
                ? assessmentScopeLabels.join(", ")
                : "None selected"}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium text-foreground">Levels</dt>
          <dd>{sortedLevels.length}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Pillars</dt>
          <dd>{pillars.length}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Criteria</dt>
          <dd>{criteria.length}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Scored questions</dt>
          <dd>{questions.length}</dd>
        </div>
      </dl>

      <section>
        <h3 className="font-medium text-foreground">Maturity levels</h3>
        <ul className="mt-2 flex flex-col gap-1">
          {sortedLevels.map((level) => (
            <li key={level.id}>
              {level.level_number}. {level.name}
            </li>
          ))}
          {sortedLevels.length === 0 ? (
            <li className="text-muted-foreground">No levels configured.</li>
          ) : null}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-medium text-foreground">
          Pillars, criteria and questions
        </h3>
        {hierarchy.pillars.map((pillar, pillarIndex) => (
          <article
            key={pillar.id}
            className="leh-authoring-pillar"
            data-testid={`framework-preview-pillar-${pillar.id}`}
          >
            <h4 className="font-medium">
              {hierarchyDisplayLabel(pillarIndex, pillar.name)}
            </h4>
            <div className="mt-3 flex flex-col gap-3">
              {pillar.criteria.map((criterion, criterionIndex) => (
                <div
                  key={criterion.id}
                  className="leh-authoring-criterion"
                  data-testid={`framework-preview-criterion-${criterion.id}`}
                >
                  <p className="font-medium">
                    {hierarchyDisplayLabel(criterionIndex, criterion.name)}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1 pl-4 text-muted-foreground">
                    {criterion.questions.map((question, questionIndex) => (
                      <li
                        key={question.id}
                        data-testid={`framework-preview-question-${question.id}`}
                      >
                        {hierarchyDisplayLabel(questionIndex, question.prompt)}
                      </li>
                    ))}
                    {criterion.questions.length === 0 ? (
                      <li>No scored questions linked.</li>
                    ) : null}
                  </ul>
                </div>
              ))}
              {pillar.criteria.length === 0 ? (
                <p className="pl-3 text-muted-foreground">
                  No criteria configured.
                </p>
              ) : null}
            </div>
          </article>
        ))}
        {hierarchy.pillars.length === 0 ? (
          <p className="text-muted-foreground">No pillars configured.</p>
        ) : null}
        {hierarchy.unlinkedQuestions.length > 0 ? (
          <article className="rounded-md border border-border p-4">
            <h4 className="font-medium">Questions not linked to a criterion</h4>
            <ul className="mt-2 flex flex-col gap-1 pl-4 text-muted-foreground">
              {hierarchy.unlinkedQuestions.map((question, questionIndex) => (
                <li key={question.id}>
                  {hierarchyDisplayLabel(questionIndex, question.prompt)}
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>
    </div>
  );
}
