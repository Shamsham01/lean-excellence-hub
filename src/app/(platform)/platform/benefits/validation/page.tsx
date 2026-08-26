import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BenefitValidationActions } from "@/components/benefits/benefit-validation-queue-actions";
import { callBenefitRpc } from "@/lib/benefits/supabase-untyped";
import {
  classificationSummary,
  classificationBadgeVariant,
} from "@/lib/benefits/classification";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
  formatPeriodLabel,
} from "@/lib/benefits/forecast";
import { benefitStatusBadgeVariant, benefitStatusLabel } from "@/lib/benefits/status";
import type { BenefitValidationQueue } from "@/lib/benefits/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function BenefitValidationQueuePage() {
  const [canValidateCi, canValidateFinance, canValidateRealisation] = await Promise.all([
    currentMemberHasPermission("benefits.validate.ci"),
    currentMemberHasPermission("benefits.validate.finance"),
    currentMemberHasPermission("benefits.realisation.validate"),
  ]);
  if (!canValidateCi && !canValidateFinance && !canValidateRealisation) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: queueData } = await callBenefitRpc<BenefitValidationQueue>(
    supabase,
    "get_benefit_validation_queue",
  );

  const queue = queueData ?? { benefits: [], realisation_entries: [] };

  return (
    <div className="flex flex-col gap-6" data-testid="benefit-validation-queue-page">
      <PageHeader
        title="Benefit validation queue"
        description="Benefits and realisation entries awaiting your validation decision."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Benefits awaiting validation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {queue.benefits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No benefits in your validation queue.</p>
            ) : (
              queue.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {benefit.benefit_number ? `${benefit.benefit_number} · ` : ""}
                      {benefit.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {classificationSummary(
                        benefit.benefit_class,
                        benefit.financial_type,
                        null,
                      )}
                      · {benefit.validation_role.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={benefitStatusBadgeVariant(benefit.status)}>
                      {benefitStatusLabel(benefit.status)}
                    </Badge>
                    <Badge variant={classificationBadgeVariant(benefit.benefit_class)}>
                      {benefit.benefit_class}
                    </Badge>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/platform/benefits/${benefit.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Realisation entries awaiting validation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {queue.realisation_entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No realisation entries awaiting validation.</p>
            ) : (
              queue.realisation_entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{entry.benefit_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPeriodLabel(entry.period_start, entry.period_end)}
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {entry.financial_amount != null
                          ? formatBenefitCurrencyAmount(entry.financial_amount, null)
                          : formatMeasureValue(entry.measure_value, entry.measure_unit)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/platform/benefits/${entry.benefit_id}`}>Open benefit</Link>
                    </Button>
                  </div>
                  <BenefitValidationActions
                    entryId={entry.id}
                    benefitId={entry.benefit_id}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
