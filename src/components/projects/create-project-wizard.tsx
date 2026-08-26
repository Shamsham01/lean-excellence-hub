"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createImprovementProject } from "@/app/(platform)/platform/projects/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
  "Basics",
  "Charter",
  "Methodology",
  "Team",
  "Measures",
  "Source",
  "Review",
] as const;

type UnitOption = { id: string; name: string };
type MethodologyOption = {
  versionId: string;
  label: string;
};
type MemberOption = { id: string; label: string };

type CreateProjectWizardProps = {
  units: UnitOption[];
  methodologies: MethodologyOption[];
  members: MemberOption[];
};

type MeasureDraft = {
  key: string;
  name: string;
  unit: string;
  baseline: string;
  target: string;
};

export function CreateProjectWizard({
  units,
  methodologies,
  members,
}: CreateProjectWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [problem, setProblem] = useState("");
  const [objective, setObjective] = useState("");
  const [impact, setImpact] = useState("");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [constraints, setConstraints] = useState("");
  const [sustainment, setSustainment] = useState("");
  const [methodologyVersionId, setMethodologyVersionId] = useState(
    methodologies[0]?.versionId ?? "",
  );
  const [ownerId, setOwnerId] = useState(members[0]?.id ?? "");
  const [measures, setMeasures] = useState<MeasureDraft[]>([
    { key: "primary", name: "", unit: "", baseline: "", target: "" },
  ]);
  const [sourceResourceId, setSourceResourceId] = useState("");

  function nextStep() {
    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  }

  function prevStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const projectId = await createImprovementProject({
        title: title.trim(),
        unitId,
        ...(problem.trim() ? { problemStatement: problem.trim() } : {}),
        ...(objective.trim() ? { objective: objective.trim() } : {}),
        ...(impact.trim() ? { expectedImpactSummary: impact.trim() } : {}),
        ...(scopeIn.trim() ? { scopeIn: scopeIn.trim() } : {}),
        ...(scopeOut.trim() ? { scopeOut: scopeOut.trim() } : {}),
        ...(baseline.trim() ? { baselineSummary: baseline.trim() } : {}),
        ...(target.trim() ? { targetSummary: target.trim() } : {}),
        ...(constraints.trim() ? { constraintsRisks: constraints.trim() } : {}),
        ...(sustainment.trim() ? { sustainmentExpectation: sustainment.trim() } : {}),
        ...(methodologyVersionId ? { methodologyVersionId } : {}),
        ...(ownerId ? { ownerMembershipId: ownerId } : {}),
        measures: measures
          .filter((measure) => measure.name.trim())
          .map((measure) => ({
            key: measure.key,
            name: measure.name.trim(),
            ...(measure.unit.trim() ? { unitLabel: measure.unit.trim() } : {}),
            ...(measure.baseline.trim()
              ? { baseline: Number(measure.baseline) }
              : {}),
            ...(measure.target.trim() ? { target: Number(measure.target) } : {}),
          })),
        ...(sourceResourceId.trim() ? { sourceResourceId: sourceResourceId.trim() } : {}),
      });
      router.push(`/platform/projects/${projectId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project creation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="create-project-wizard">
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
                <span>Project title</span>
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
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Problem statement</span>
                <Textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Objective</span>
                <Textarea rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Expected impact</span>
                <Textarea rows={2} value={impact} onChange={(e) => setImpact(e.target.value)} />
              </label>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Scope in</span>
                <Textarea rows={2} value={scopeIn} onChange={(e) => setScopeIn(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Scope out</span>
                <Textarea rows={2} value={scopeOut} onChange={(e) => setScopeOut(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Baseline summary</span>
                <Textarea rows={2} value={baseline} onChange={(e) => setBaseline(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Target summary</span>
                <Textarea rows={2} value={target} onChange={(e) => setTarget(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Constraints & risks</span>
                <Textarea rows={2} value={constraints} onChange={(e) => setConstraints(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Sustainment expectation</span>
                <Textarea rows={2} value={sustainment} onChange={(e) => setSustainment(e.target.value)} />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>Methodology</span>
              <select
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                value={methodologyVersionId}
                onChange={(e) => setMethodologyVersionId(e.target.value)}
              >
                {methodologies.length === 0 ? (
                  <option value="">No published methodologies</option>
                ) : (
                  methodologies.map((methodology) => (
                    <option key={methodology.versionId} value={methodology.versionId}>
                      {methodology.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}

          {step === 3 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>Project owner</span>
              <select
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-4">
              {measures.map((measure, index) => (
                <div key={measure.key} className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium">Measure {index + 1}</p>
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="Display name"
                      value={measure.name}
                      onChange={(e) =>
                        setMeasures((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, name: e.target.value } : row,
                          ),
                        )
                      }
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input
                        placeholder="Unit"
                        value={measure.unit}
                        onChange={(e) =>
                          setMeasures((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, unit: e.target.value } : row,
                            ),
                          )
                        }
                      />
                      <Input
                        placeholder="Baseline"
                        value={measure.baseline}
                        onChange={(e) =>
                          setMeasures((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, baseline: e.target.value } : row,
                            ),
                          )
                        }
                      />
                      <Input
                        placeholder="Target"
                        value={measure.target}
                        onChange={(e) =>
                          setMeasures((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, target: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setMeasures((prev) => [
                    ...prev,
                    {
                      key: `measure-${prev.length + 1}`,
                      name: "",
                      unit: "",
                      baseline: "",
                      target: "",
                    },
                  ])
                }
              >
                Add measure
              </Button>
            </div>
          ) : null}

          {step === 5 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>Source resource ID (optional)</span>
              <Input
                value={sourceResourceId}
                onChange={(e) => setSourceResourceId(e.target.value)}
                placeholder="Link from suggestion or other source"
              />
            </label>
          ) : null}

          {step === 6 ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>
                <span className="font-medium">Title:</span> {title || "—"}
              </p>
              <p>
                <span className="font-medium">Unit:</span>{" "}
                {units.find((unit) => unit.id === unitId)?.name ?? "—"}
              </p>
              <p>
                <span className="font-medium">Methodology:</span>{" "}
                {methodologies.find((m) => m.versionId === methodologyVersionId)?.label ??
                  "Not selected"}
              </p>
              <p>
                <span className="font-medium">Owner:</span>{" "}
                {members.find((m) => m.id === ownerId)?.label ?? "—"}
              </p>
              <p>
                <span className="font-medium">Measures:</span>{" "}
                {measures.filter((m) => m.name.trim()).length} defined
              </p>
              <p className="text-muted-foreground">
                Charter, methodology, team, and measures are captured in this wizard and can be
                completed on the project workspace after creation.
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={prevStep}>
                Back
              </Button>
            ) : null}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep} disabled={step === 0 && !title.trim()}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={loading || !title.trim()}>
                {loading ? "Creating…" : "Create project"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
