import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UseQuickStartTemplateButton } from "@/components/maturity/use-quick-start-template-button";
import { PageHeader } from "@/components/platform/page-header";
import {
  maturityTemplateCounts,
  type MaturityFrameworkTemplate,
} from "@/modules/maturity/templates";
import { scopeTypeLabel } from "@/modules/maturity/semantic-scope";

export function MaturityTemplatePreview({
  template,
  canManage,
}: {
  template: MaturityFrameworkTemplate;
  canManage: boolean;
}) {
  const counts = maturityTemplateCounts(template);

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="maturity-template-preview-page"
      data-template-key={template.key}
    >
      <PageHeader
        title={template.name}
        description={template.description}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" asChild>
              <AppLink
                href="/platform/maturity/models"
                data-testid="template-preview-back-link"
              >
                Back to frameworks
              </AppLink>
            </Button>
            {canManage ? (
              <UseQuickStartTemplateButton templateKey={template.key} />
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="information">LEH Quick Start</Badge>
        <Badge variant="outline">Optional starting point</Badge>
        <Badge variant="secondary">Deploys as draft</Badge>
      </div>

      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        This is a practical starting point, not a mandatory Lean methodology.
        After you use the template, the copy belongs to your organisation and
        can be edited before anyone publishes it.
      </p>

      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PreviewStat label="Pillars" value={counts.pillars} />
        <PreviewStat label="Criteria" value={counts.criteria} />
        <PreviewStat label="Questions" value={counts.scoredQuestions} />
        <PreviewStat label="Levels" value={counts.levels} />
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="typography-section-title">Assessment scope</h2>
        <p className="text-sm text-muted-foreground">
          {template.assessmentScopes.map(scopeTypeLabel).join(", ")}
        </p>
      </section>

      <section
        className="flex flex-col gap-3"
        data-testid="template-preview-levels"
      >
        <h2 className="typography-section-title">Maturity levels</h2>
        <ol className="flex flex-col gap-3">
          {template.levels.map((level, index) => (
            <li key={level.name}>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4">
                  <p className="font-medium">
                    {index + 1}. {level.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {level.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {level.guidance}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="flex flex-col gap-4"
        data-testid="template-preview-pillars"
      >
        <h2 className="typography-section-title">
          Pillars, criteria and questions
        </h2>
        {template.pillars.map((pillar, pillarIndex) => (
          <article
            key={pillar.name}
            className="rounded-lg border border-border bg-card"
            data-testid={`template-preview-pillar-${pillarIndex + 1}`}
          >
            <div className="flex flex-col gap-2 border-b border-border p-4 sm:p-5">
              <h3 className="text-base font-semibold">
                {pillarIndex + 1}. {pillar.name}
              </h3>
              {pillar.description ? (
                <p className="text-sm text-muted-foreground">
                  {pillar.description}
                </p>
              ) : null}
              {pillar.guidance ? (
                <p className="text-sm text-muted-foreground">
                  {pillar.guidance}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col">
              {pillar.criteria.map((criterion, criterionIndex) => (
                <details
                  key={criterion.name}
                  className="border-b border-border last:border-b-0"
                  data-testid={`template-preview-criterion-${pillarIndex + 1}-${criterionIndex + 1}`}
                >
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        {criterionIndex + 1}. {criterion.name}
                      </span>
                      <span className="shrink-0 text-xs font-normal text-muted-foreground">
                        {criterion.questions.length} questions
                      </span>
                    </span>
                  </summary>
                  <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
                    <p className="text-sm text-muted-foreground">
                      {criterion.description}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Assessment guidance: {criterion.guidance}
                    </p>
                    <ul className="flex flex-col gap-2 pl-1">
                      {criterion.questions.map((question, questionIndex) => (
                        <li
                          key={question.prompt}
                          className="text-sm"
                          data-testid={`template-preview-question-${pillarIndex + 1}-${criterionIndex + 1}-${questionIndex + 1}`}
                        >
                          {questionIndex + 1}. {question.prompt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
