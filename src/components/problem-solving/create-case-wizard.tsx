"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addProblemSolvingSourceLink,
  createProblemSolvingCaseDraft,
  updateProblemSolvingCaseDraft,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, priorityLabel, SEVERITIES, severityLabel } from "@/lib/problem-solving/status";
import type { ProblemSolvingMethod } from "@/lib/problem-solving/types";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
  "Basics",
  "Problem",
  "Scope",
  "Classification",
  "Method",
  "Review",
] as const;

type UnitOption = { id: string; name: string };
type MemberOption = { id: string; label: string };

type CreateCaseWizardProps = {
  units: UnitOption[];
  members: MemberOption[];
  methods: ProblemSolvingMethod[];
};

export function CreateCaseWizard({ units, members, methods }: CreateCaseWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(members[0]?.id ?? "");
  const [facilitatorId, setFacilitatorId] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [background, setBackground] = useState("");
  const [businessImpact, setBusinessImpact] = useState("");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [targetCondition, setTargetCondition] = useState("");
  const [detectedAt, setDetectedAt] = useState("");
  const [severity, setSeverity] = useState<string>(SEVERITIES[1]);
  const [priority, setPriority] = useState<string>(PRIORITIES[1]);
  const [methodVersionId, setMethodVersionId] = useState("");
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
      const draftResult = await createProblemSolvingCaseDraft({
        title: title.trim(),
        organisationalUnitId: unitId,
        ownerMembershipId: ownerId,
        ...(problemStatement.trim() ? { problemStatement: problemStatement.trim() } : {}),
        ...(background.trim() ? { background: background.trim() } : {}),
        ...(businessImpact.trim() ? { businessImpact: businessImpact.trim() } : {}),
        ...(scopeIn.trim() ? { scopeIn: scopeIn.trim() } : {}),
        ...(scopeOut.trim() ? { scopeOut: scopeOut.trim() } : {}),
        ...(targetCondition.trim() ? { targetCondition: targetCondition.trim() } : {}),
        ...(detectedAt ? { detectedAt: new Date(detectedAt).toISOString() } : {}),
        severity,
        priority,
        ...(facilitatorId ? { facilitatorMembershipId: facilitatorId } : {}),
        ...(methodVersionId ? { methodVersionId } : {}),
        ...(sourceResourceId.trim() ? { sourceResourceId: sourceResourceId.trim() } : {}),
      });
      if (draftResult.error || !draftResult.id) {
        throw new Error(draftResult.error ?? "Draft creation failed");
      }
      const caseId = draftResult.id;

      const updateResult = await updateProblemSolvingCaseDraft({
        caseId,
        title: title.trim(),
        ...(problemStatement.trim() ? { problemStatement: problemStatement.trim() } : {}),
        ...(background.trim() ? { background: background.trim() } : {}),
        ...(businessImpact.trim() ? { businessImpact: businessImpact.trim() } : {}),
        ...(scopeIn.trim() ? { scopeIn: scopeIn.trim() } : {}),
        ...(scopeOut.trim() ? { scopeOut: scopeOut.trim() } : {}),
        ...(targetCondition.trim() ? { targetCondition: targetCondition.trim() } : {}),
        ...(detectedAt ? { detectedAt: new Date(detectedAt).toISOString() } : {}),
        severity,
        priority,
        ownerMembershipId: ownerId,
        ...(facilitatorId ? { facilitatorMembershipId: facilitatorId } : {}),
        ...(methodVersionId ? { methodVersionId } : {}),
      });
      if (updateResult.error) throw new Error(updateResult.error);

      if (sourceResourceId.trim()) {
        await addProblemSolvingSourceLink(caseId, sourceResourceId.trim(), "primary");
      }

      router.push(`/platform/problem-solving/${caseId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Case creation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="create-problem-solving-wizard">
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
                <span>Case title</span>
                <Input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="create-case-title"
                />
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
                  data-testid="create-case-owner"
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Facilitator (optional)</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={facilitatorId}
                  onChange={(e) => setFacilitatorId(e.target.value)}
                  data-testid="create-case-facilitator"
                >
                  <option value="">None</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.label}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Problem statement</span>
                <Textarea
                  rows={3}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Background</span>
                <Textarea rows={3} value={background} onChange={(e) => setBackground(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Business impact</span>
                <Textarea
                  rows={3}
                  value={businessImpact}
                  onChange={(e) => setBusinessImpact(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Detected at</span>
                <Input
                  type="datetime-local"
                  value={detectedAt}
                  onChange={(e) => setDetectedAt(e.target.value)}
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
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
                <span>Target condition</span>
                <Textarea
                  rows={3}
                  value={targetCondition}
                  onChange={(e) => setTargetCondition(e.target.value)}
                />
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Severity</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  {SEVERITIES.map((value) => (
                    <option key={value} value={value}>{severityLabel(value)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Priority</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>{priorityLabel(value)}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Method version</span>
                <select
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                  value={methodVersionId}
                  onChange={(e) => setMethodVersionId(e.target.value)}
                  data-testid="create-case-method-version"
                >
                  <option value="">Select later on activation</option>
                  {methods.map((method) =>
                    method.current_version ? (
                      <option key={method.current_version.id} value={method.current_version.id}>
                        {method.name} (v{method.current_version.version_number})
                      </option>
                    ) : null,
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Source resource ID (optional)</span>
                <Input
                  value={sourceResourceId}
                  onChange={(e) => setSourceResourceId(e.target.value)}
                  placeholder="Link to suggestion or project"
                />
              </label>
            </>
          ) : null}

          {step === 5 ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Title</dt>
                <dd className="font-medium">{title || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Problem statement</dt>
                <dd>{problemStatement || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Severity / priority</dt>
                <dd>
                  {severityLabel(severity)} / {priorityLabel(priority)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Target condition</dt>
                <dd>{targetCondition || "—"}</dd>
              </div>
            </dl>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="outline" onClick={prevStep} disabled={step === 0 || loading}>
              Back
            </Button>
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep} disabled={loading}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                data-testid="create-case-submit"
              >
                {loading ? "Creating…" : "Create draft case"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
