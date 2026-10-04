import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UseQuickStartTemplateButton } from "@/components/maturity/use-quick-start-template-button";
import {
  maturityTemplateCounts,
  maturityTemplatePreviewPath,
  type MaturityFrameworkTemplate,
} from "@/modules/maturity/templates";

export function MaturityQuickStartCard({
  template,
  canManage,
}: {
  template: MaturityFrameworkTemplate;
  canManage: boolean;
}) {
  const counts = maturityTemplateCounts(template);
  const previewHref = maturityTemplatePreviewPath(template.key);

  return (
    <Card
      className="overflow-hidden border-border bg-card shadow-sm"
      data-testid="maturity-quick-start-card"
      data-template-key={template.key}
    >
      <CardHeader className="gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="information">LEH Quick Start</Badge>
          <Badge variant="outline">Starting point</Badge>
        </div>
        <div className="flex flex-col gap-2">
          <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
            {template.name}
          </CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-relaxed">
            {template.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-5 pt-0 sm:p-6 sm:pt-0">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickStartStat label="Pillars" value={counts.pillars} />
          <QuickStartStat label="Criteria" value={counts.criteria} />
          <QuickStartStat
            label="Assessment questions"
            value={counts.scoredQuestions}
          />
          <QuickStartStat label="Maturity levels" value={counts.levels} />
        </dl>
        <p className="text-sm text-muted-foreground">
          Deploying creates an organisation-owned draft you can edit. Nothing is
          published until you choose Publish.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Button variant="outline" asChild className="sm:w-auto">
            <AppLink
              href={previewHref}
              data-testid="preview-quick-start-template"
            >
              Preview
            </AppLink>
          </Button>
          {canManage ? (
            <UseQuickStartTemplateButton
              templateKey={template.key}
              className="sm:w-auto"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStartStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  );
}
