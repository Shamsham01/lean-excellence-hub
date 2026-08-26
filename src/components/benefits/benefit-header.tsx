import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  classificationSummary,
  classificationBadgeVariant,
  benefitClassLabel,
} from "@/lib/benefits/classification";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
} from "@/lib/benefits/forecast";
import {
  benefitStatusBadgeVariant,
  benefitStatusLabel,
} from "@/lib/benefits/status";
import type { BenefitDetail } from "@/lib/benefits/types";

type BenefitHeaderProps = {
  detail: BenefitDetail;
  ownerName?: string | null;
  canManage: boolean;
  canValidateCi: boolean;
  canValidateFinance: boolean;
  canRecordRealisation: boolean;
  message?: string | null;
  onSubmit?: () => void;
  onStartRealisation?: () => void;
  onMarkRealised?: () => void;
  onWithdraw?: () => void;
};

export function BenefitHeader({
  detail,
  ownerName,
  canManage,
  canValidateCi,
  canValidateFinance,
  canRecordRealisation,
  message,
  onSubmit,
  onStartRealisation,
  onMarkRealised,
  onWithdraw,
}: BenefitHeaderProps) {
  const showSubmit = canManage && detail.status === "draft" && onSubmit;
  const showStart =
    canManage && detail.status === "approved" && onStartRealisation;
  const showMarkRealised =
    canManage && detail.status === "realising" && onMarkRealised;
  const showWithdraw =
    canManage &&
    ["draft", "submitted", "approved", "realising"].includes(detail.status) &&
    onWithdraw;

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6" data-testid="benefit-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {detail.benefit_number ?? "Draft benefit"}
          </p>
          <h1 className="typography-page-title">{detail.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={benefitStatusBadgeVariant(detail.status)}>
              {benefitStatusLabel(detail.status)}
            </Badge>
            <Badge variant={classificationBadgeVariant(detail.benefit_class)}>
              {classificationSummary(
                detail.benefit_class,
                detail.financial_type,
                detail.non_financial_type,
              )}
            </Badge>
            <Badge variant="outline">{benefitClassLabel(detail.benefit_class)}</Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {detail.unit_name ? (
              <div>
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="font-medium">{detail.unit_name}</dd>
              </div>
            ) : null}
            {detail.category_name ? (
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{detail.category_name}</dd>
              </div>
            ) : null}
            {ownerName ? (
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium">{ownerName}</dd>
              </div>
            ) : null}
            {detail.planned_realisation_end ? (
              <div>
                <dt className="text-muted-foreground">Planned end</dt>
                <dd className="font-medium">{detail.planned_realisation_end}</dd>
              </div>
            ) : null}
            {detail.benefit_class === "financial" ? (
              <div>
                <dt className="text-muted-foreground">Validated actual total</dt>
                <dd className="font-medium tabular-nums">
                  {formatBenefitCurrencyAmount(
                    detail.validated_realised_total,
                    detail.reporting_currency_snapshot,
                  )}
                </dd>
              </div>
            ) : (
              <div>
                <dt className="text-muted-foreground">Validated actual measure</dt>
                <dd className="font-medium tabular-nums">
                  {formatMeasureValue(
                    detail.validated_realised_total,
                    detail.baseline_measure_unit,
                  )}
                </dd>
              </div>
            )}
            {detail.portfolio_allocation_percentage != null ? (
              <div>
                <dt className="text-muted-foreground">Portfolio allocation</dt>
                <dd className="font-medium tabular-nums">
                  {detail.portfolio_allocation_percentage}%
                </dd>
              </div>
            ) : null}
          </dl>
          {(canValidateCi || canValidateFinance || canRecordRealisation) && detail.status === "submitted" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Validation queue may include this benefit for assigned validators.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {showSubmit ? (
            <Button size="sm" onClick={onSubmit} data-testid="benefit-submit-button">
              Submit for validation
            </Button>
          ) : null}
          {showStart ? (
            <Button size="sm" onClick={onStartRealisation}>
              Start realisation
            </Button>
          ) : null}
          {showMarkRealised ? (
            <Button size="sm" onClick={onMarkRealised}>
              Mark realised
            </Button>
          ) : null}
          {showWithdraw ? (
            <Button size="sm" variant="outline" onClick={onWithdraw}>
              Withdraw
            </Button>
          ) : null}
        </div>
      </div>
      {message ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
