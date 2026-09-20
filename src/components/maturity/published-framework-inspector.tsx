import {
  sortMaturityQuestions,
  type MaturityAuthoringCriterion,
  type MaturityAuthoringPillar,
  type MaturityAuthoringQuestion,
} from "@/modules/maturity/framework-authoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PublishedLevel = {
  id: string;
  level_number: number;
  name: string;
};

type PublishedFrameworkInspectorProps = {
  versionNumber: number;
  levels: PublishedLevel[];
  pillars: MaturityAuthoringPillar[];
  criteria: MaturityAuthoringCriterion[];
  questions: MaturityAuthoringQuestion[];
};

export function PublishedFrameworkInspector({
  versionNumber,
  levels,
  pillars,
  criteria,
  questions,
}: PublishedFrameworkInspectorProps) {
  const sortedPillars = [...pillars].sort(
    (left, right) => left.position - right.position || left.id.localeCompare(right.id),
  );
  const sortedLevels = [...levels].sort(
    (left, right) => left.level_number - right.level_number,
  );
  const sortedQuestions = sortMaturityQuestions(questions);

  return (
    <Card data-testid="published-framework-inspector">
      <CardHeader>
        <CardTitle>Published structure (read-only)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 text-sm">
        <p className="text-muted-foreground">
          Version {versionNumber} is immutable. Use Create new version to
          correct structure without altering assessments tied to this version.
        </p>

        <section>
          <h3 className="font-medium text-foreground">Levels</h3>
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
          {sortedPillars.map((pillar) => {
            const pillarCriteria = criteria
              .filter((criterion) => criterion.pillar_id === pillar.id)
              .sort(
                (left, right) =>
                  left.position - right.position ||
                  left.id.localeCompare(right.id),
              );

            return (
              <article
                key={pillar.id}
                className="rounded-md border border-border p-4"
                data-testid={`published-pillar-${pillar.id}`}
              >
                <h4 className="font-medium">
                  {pillar.position}. {pillar.name}
                </h4>
                <div className="mt-3 flex flex-col gap-3">
                  {pillarCriteria.map((criterion) => {
                    const criterionQuestions = sortedQuestions.filter(
                      (question) => question.criterion_id === criterion.id,
                    );

                    return (
                      <div key={criterion.id} className="pl-3">
                        <p className="font-medium">
                          {criterion.position}. {criterion.name}
                        </p>
                        <ul className="mt-1 flex flex-col gap-1 pl-4 text-muted-foreground">
                          {criterionQuestions.map((question) => (
                            <li key={question.id}>
                              {question.position}. {question.prompt}
                            </li>
                          ))}
                          {criterionQuestions.length === 0 ? (
                            <li>No scored questions linked.</li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                  {pillarCriteria.length === 0 ? (
                    <p className="pl-3 text-muted-foreground">
                      No criteria configured.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
          {sortedPillars.length === 0 ? (
            <p className="text-muted-foreground">No pillars configured.</p>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}
