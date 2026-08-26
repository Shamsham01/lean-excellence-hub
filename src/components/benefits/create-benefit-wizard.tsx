"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addBenefitSourceLink,
  createBenefitDraft,
  createBenefitForecastDraft,
  replaceBenefitForecastPeriods,
  updateBenefitDraft,
} from "@/app/(platform)/platform/benefits/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FINANCIAL_TYPES,
  NON_FINANCIAL_TYPES,
  benefitClassLabel,
  financialTypeLabel,
  nonFinancialTypeLabel,
} from "@/lib/benefits/classification";
import { REALISATION_PATTERNS, realisationPatternLabel } from "@/lib/benefits/forecast";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
  "Basics",
  "Classification",
  "Baseline",
  "Forecast",
  "Source",
  "Review",
] as const;

type UnitOption = { id: string; name: string };
type MemberOption = { id: string; label: string };
type CategoryOption = { id: string; label: string };

type CreateBenefitWizardProps = {
  units: UnitOption[];
  members: MemberOption[];
  categories: CategoryOption[];
};

export function CreateBenefitWizard({ units, members, categories }: CreateBenefitWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(members[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");

  const [benefitClass, setBenefitClass] = useState<"financial" | "non_financial">("financial");
  const [financialType, setFinancialType] = useState(FINANCIAL_TYPES[0]);
  const [nonFinancialType, setNonFinancialType] = useState(NON_FINANCIAL_TYPES[0]);

  const [baselineDescription, setBaselineDescription] = useState("");
  const [baselinePeriodStart, setBaselinePeriodStart] = useState("");
  const [baselinePeriodEnd, setBaselinePeriodEnd] = useState("");
  const [baselineMeasureValue, setBaselineMeasureValue] = useState("");
  const [baselineMeasureUnit, setBaselineMeasureUnit] = useState("");
  const [baselineFinancialValue, setBaselineFinancialValue] = useState("");

  const [realisationPattern, setRealisationPattern] = useState<string>(REALISATION_PATTERNS[0]);
  const [forecastStart, setForecastStart] = useState("");
  const [forecastEnd, setForecastEnd] = useState("");
  const [forecastTotal, setForecastTotal] = useState("");
  const [calculationBasis, setCalculationBasis] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [targetMeasureValue, setTargetMeasureValue] = useState("");
  const [targetMeasureUnit, setTargetMeasureUnit] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [periodAmount, setPeriodAmount] = useState("");

  const [isStandalone, setIsStandalone] = useState(false);
  const [sourceResourceId, setSourceResourceId] = useState("");

  function nextStep() {
    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  }

  function prevStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleCreate() {
    if (!title.trim() || !unitId || !ownerId) {
      setError("Title, unit, and owner are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const draftResult = await createBenefitDraft({
        title: title.trim(),
        organisationalUnitId: unitId,
        benefitClass,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(benefitClass === "financial"
          ? { financialType }
          : { nonFinancialType }),
        ...(categoryId ? { categoryId } : {}),
        ownerMembershipId: ownerId,
        isStandaloneInitiative: isStandalone,
        ...(sourceResourceId.trim() && !isStandalone
          ? { primarySourceResourceId: sourceResourceId.trim() }
          : {}),
      });
      if (draftResult.error || !draftResult.id) {
        throw new Error(draftResult.error ?? "Draft creation failed");
      }
      const benefitId = draftResult.id;

      const updateResult = await updateBenefitDraft({
        benefitId,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        benefitClass,
        ...(benefitClass === "financial"
          ? { financialType }
          : { nonFinancialType }),
        ...(categoryId ? { categoryId } : {}),
        organisationalUnitId: unitId,
        ownerMembershipId: ownerId,
        ...(baselineDescription.trim()
          ? { baselineDescription: baselineDescription.trim() }
          : {}),
        ...(baselinePeriodStart ? { baselinePeriodStart } : {}),
        ...(baselinePeriodEnd ? { baselinePeriodEnd } : {}),
        ...(baselineMeasureValue.trim()
          ? { baselineMeasureValue: Number(baselineMeasureValue) }
          : {}),
        ...(baselineMeasureUnit.trim() ? { baselineMeasureUnit: baselineMeasureUnit.trim() } : {}),
        ...(baselineFinancialValue.trim()
          ? { baselineFinancialValue: Number(baselineFinancialValue) }
          : {}),
        ...(plannedStart ? { plannedRealisationStart: plannedStart } : {}),
        ...(plannedEnd ? { plannedRealisationEnd: plannedEnd } : {}),
        isStandaloneInitiative: isStandalone,
      });
      if (updateResult.error) throw new Error(updateResult.error);

      if (forecastStart && forecastEnd) {
        const forecastResult = await createBenefitForecastDraft({
          benefitId,
          realisationPattern,
          forecastStartDate: forecastStart,
          forecastEndDate: forecastEnd,
          ...(benefitClass === "financial" && forecastTotal.trim()
            ? { forecastTotalAmount: Number(forecastTotal) }
            : {}),
          ...(calculationBasis.trim() ? { calculationBasis: calculationBasis.trim() } : {}),
          ...(assumptions.trim() ? { assumptions: assumptions.trim() } : {}),
          ...(benefitClass === "non_financial" && targetMeasureValue.trim()
            ? { targetMeasureValue: Number(targetMeasureValue) }
            : {}),
          ...(targetMeasureUnit.trim() ? { targetMeasureUnit: targetMeasureUnit.trim() } : {}),
          ...(targetDate ? { targetDate } : {}),
        });
        if (forecastResult.error || !forecastResult.id) {
          throw new Error(forecastResult.error ?? "Forecast draft failed");
        }
        if (benefitClass === "financial" && forecastTotal.trim()) {
          const periods =
            realisationPattern === "recurring" && periodAmount.trim()
              ? [
                  {
                    period_start: forecastStart,
                    period_end: forecastEnd,
                    forecast_amount: Number(periodAmount),
                    display_order: 1,
                  },
                ]
              : [
                  {
                    period_start: forecastStart,
                    period_end: forecastEnd,
                    forecast_amount: Number(forecastTotal),
                    display_order: 1,
                  },
                ];
          const periodsResult = await replaceBenefitForecastPeriods(
            forecastResult.id,
            benefitId,
            periods,
          );
          if (periodsResult.error) {
            throw new Error(periodsResult.error);
          }
        }
      }

      if (sourceResourceId.trim() && !isStandalone) {
        await addBenefitSourceLink(benefitId, sourceResourceId.trim(), "contributing");
      }

      router.push(`/platform/benefits/${benefitId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benefit creation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="create-benefit-wizard">
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WIZARD_STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={cn(
              "shrink-0 rounded-md border px-3 py-2 text-xs font-medium min-h-9",
              index === step
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 0 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Benefit title</span>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Organisation unit</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Owner</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Category</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Description</span>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Planned realisation start</span>
                  <Input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Planned realisation end</span>
                  <Input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
                </label>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={benefitClass === "financial" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBenefitClass("financial")}
                >
                  {benefitClassLabel("financial")}
                </Button>
                <Button
                  type="button"
                  variant={benefitClass === "non_financial" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBenefitClass("non_financial")}
                >
                  {benefitClassLabel("non_financial")}
                </Button>
              </div>
              {benefitClass === "financial" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span>Financial type</span>
                  <select
                    className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                    value={financialType}
                    onChange={(e) => setFinancialType(e.target.value as typeof financialType)}
                  >
                    {FINANCIAL_TYPES.map((type) => (
                      <option key={type} value={type}>{financialTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-1 text-sm">
                  <span>Non-financial type</span>
                  <select
                    className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                    value={nonFinancialType}
                    onChange={(e) => setNonFinancialType(e.target.value as typeof nonFinancialType)}
                  >
                    {NON_FINANCIAL_TYPES.map((type) => (
                      <option key={type} value={type}>{nonFinancialTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Baseline description</span>
                <Textarea
                  rows={3}
                  value={baselineDescription}
                  onChange={(e) => setBaselineDescription(e.target.value)}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Baseline period start</span>
                  <Input
                    type="date"
                    value={baselinePeriodStart}
                    onChange={(e) => setBaselinePeriodStart(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Baseline period end</span>
                  <Input
                    type="date"
                    value={baselinePeriodEnd}
                    onChange={(e) => setBaselinePeriodEnd(e.target.value)}
                  />
                </label>
              </div>
              {benefitClass === "financial" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span>Baseline financial value</span>
                  <Input
                    type="number"
                    value={baselineFinancialValue}
                    onChange={(e) => setBaselineFinancialValue(e.target.value)}
                  />
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Baseline measure value</span>
                    <Input
                      type="number"
                      value={baselineMeasureValue}
                      onChange={(e) => setBaselineMeasureValue(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Baseline measure unit</span>
                    <Input
                      value={baselineMeasureUnit}
                      onChange={(e) => setBaselineMeasureUnit(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Realisation pattern</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={realisationPattern}
                  onChange={(e) => setRealisationPattern(e.target.value)}
                >
                  {REALISATION_PATTERNS.map((pattern) => (
                    <option key={pattern} value={pattern}>
                      {realisationPatternLabel(pattern)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Forecast start</span>
                  <Input type="date" value={forecastStart} onChange={(e) => setForecastStart(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Forecast end</span>
                  <Input type="date" value={forecastEnd} onChange={(e) => setForecastEnd(e.target.value)} />
                </label>
              </div>
              {benefitClass === "financial" ? (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Forecast total amount</span>
                    <Input
                      type="number"
                      value={forecastTotal}
                      onChange={(e) => setForecastTotal(e.target.value)}
                    />
                  </label>
                  {realisationPattern === "recurring" ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span>Period forecast amount</span>
                      <Input
                        type="number"
                        value={periodAmount}
                        onChange={(e) => setPeriodAmount(e.target.value)}
                      />
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Calculation basis</span>
                    <Textarea
                      rows={2}
                      value={calculationBasis}
                      onChange={(e) => setCalculationBasis(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Target measure value</span>
                    <Input
                      type="number"
                      value={targetMeasureValue}
                      onChange={(e) => setTargetMeasureValue(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Target measure unit</span>
                    <Input
                      value={targetMeasureUnit}
                      onChange={(e) => setTargetMeasureUnit(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Target date</span>
                    <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                  </label>
                </div>
              )}
              <label className="flex flex-col gap-1 text-sm">
                <span>Assumptions</span>
                <Textarea rows={2} value={assumptions} onChange={(e) => setAssumptions(e.target.value)} />
              </label>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isStandalone}
                  onChange={(e) => setIsStandalone(e.target.checked)}
                />
                Standalone initiative (no source link required)
              </label>
              {!isStandalone ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span>Primary source resource ID</span>
                  <Input
                    value={sourceResourceId}
                    onChange={(e) => setSourceResourceId(e.target.value)}
                    placeholder="Project or suggestion resource ID"
                  />
                </label>
              ) : null}
            </>
          ) : null}

          {step === 5 ? (
            <div className="flex flex-col gap-3 text-sm">
              <p><span className="font-medium">Title:</span> {title}</p>
              <p>
                <span className="font-medium">Class:</span>{" "}
                {benefitClass === "financial"
                  ? financialTypeLabel(financialType)
                  : nonFinancialTypeLabel(nonFinancialType)}
              </p>
              <p>
                <span className="font-medium">Forecast window:</span>{" "}
                {forecastStart && forecastEnd ? `${forecastStart} → ${forecastEnd}` : "—"}
              </p>
              {benefitClass === "financial" ? (
                <p>
                  <span className="font-medium">Forecast total:</span> {forecastTotal || "—"}
                </p>
              ) : (
                <p>
                  <span className="font-medium">Target measure:</span>{" "}
                  {targetMeasureValue || "—"} {targetMeasureUnit}
                </p>
              )}
              <p>
                <span className="font-medium">Source:</span>{" "}
                {isStandalone ? "Standalone" : sourceResourceId || "Linked later"}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={prevStep}>
                Back
              </Button>
            ) : null}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep}>Continue</Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={loading}>
                {loading ? "Creating…" : "Create benefit draft"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
