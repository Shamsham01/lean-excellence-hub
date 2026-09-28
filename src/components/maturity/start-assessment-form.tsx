"use client";

import { useEffect, useState, useTransition } from "react";

import { startAssessment } from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  scopeTypeLabel,
  type MaturityAssessmentScopeType,
} from "@/modules/maturity/semantic-scope";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

type FrameworkVersion = {
  id: string;
  version_number: number;
  display_name: string;
  scope_types: MaturityAssessmentScopeType[];
};

type ScopeEntity = {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: string;
};

type LeadAssessorOption = {
  id: string;
  label: string;
};

type StartAssessmentFormProps = {
  versions: FrameworkVersion[];
  people: LeadAssessorOption[];
  defaultVersionId?: string;
};

export function StartAssessmentForm({
  versions,
  people,
  defaultVersionId,
}: StartAssessmentFormProps) {
  const [versionId, setVersionId] = useState(defaultVersionId ?? "");
  const [scopeType, setScopeType] = useState<MaturityAssessmentScopeType | "">(
    "",
  );
  const [unitId, setUnitId] = useState("");
  const [assessmentType, setAssessmentType] = useState<"self" | "formal">(
    "formal",
  );
  const [leadAssessorMembershipId, setLeadAssessorMembershipId] = useState(
    people[0]?.id ?? "",
  );
  const [entities, setEntities] = useState<ScopeEntity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedVersion = versions.find((v) => v.id === versionId);
  const allowedScopes = selectedVersion?.scope_types ?? [];
  const effectiveScopeType =
    scopeType && allowedScopes.includes(scopeType)
      ? scopeType
      : (allowedScopes[0] ?? "");

  useEffect(() => {
    if (!versionId || !effectiveScopeType) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    void supabase
      .rpc("list_maturity_assessment_scope_entities", {
        target_model_version_id: versionId,
        target_scope_type: effectiveScopeType,
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) {
          setError(rpcError.message);
          setEntities([]);
          setUnitId("");
          return;
        }
        setError(null);
        const rows = (data ?? []) as ScopeEntity[];
        setEntities(rows);
        setUnitId(rows[0]?.unit_id ?? "");
      });

    return () => {
      cancelled = true;
    };
  }, [versionId, effectiveScopeType]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!versionId || !effectiveScopeType || !unitId) {
      setError("Select framework, scope, and eligible entity.");
      return;
    }
    if (assessmentType === "formal" && !leadAssessorMembershipId) {
      setError("Select a lead assessor for a formal assessment.");
      return;
    }

    const formData = new FormData();
    formData.set("modelVersionId", versionId);
    formData.set("assessmentScopeType", effectiveScopeType);
    formData.set("unitId", unitId);
    formData.set("assessmentType", assessmentType);
    if (assessmentType === "formal" && leadAssessorMembershipId) {
      formData.set("leadAssessorMembershipId", leadAssessorMembershipId);
    }

    startTransition(async () => {
      const result = await startAssessment(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.assessmentId) {
        navigateTo(`/platform/maturity/assessments/${result.assessmentId}`);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-lg flex-col gap-4"
      data-testid="start-assessment-form"
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="modelVersionId">Framework version</Label>
        <select
          id="modelVersionId"
          name="modelVersionId"
          required
          className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
          value={versionId}
          onChange={(event) => {
            setVersionId(event.target.value);
            setScopeType("");
            setUnitId("");
            setEntities([]);
          }}
        >
          <option value="" disabled>
            Select version
          </option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.display_name} — Version {v.version_number}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="assessmentScopeType">Assess</Label>
        <select
          id="assessmentScopeType"
          name="assessmentScopeType"
          required
          className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
          value={effectiveScopeType}
          onChange={(event) => {
            setScopeType(event.target.value as MaturityAssessmentScopeType);
            setUnitId("");
            setEntities([]);
          }}
          disabled={allowedScopes.length === 0}
        >
          <option value="" disabled>
            Select scope
          </option>
          {allowedScopes.map((scope) => (
            <option key={scope} value={scope}>
              {scopeTypeLabel(scope)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="unitId">
          {effectiveScopeType ? scopeTypeLabel(effectiveScopeType) : "Entity"}
        </Label>
        <select
          id="unitId"
          name="unitId"
          required
          className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          disabled={entities.length === 0}
          data-testid="scope-entity-select"
        >
          <option value="" disabled>
            {entities.length === 0
              ? "No eligible entities for this scope"
              : "Select entity"}
          </option>
          {entities.map((entity) => (
            <option key={entity.unit_id} value={entity.unit_id}>
              {entity.unit_name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Assessment type</legend>
        <label className="flex cursor-pointer flex-col gap-1 rounded-md border border-border p-3 has-[:checked]:border-accent">
          <span className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name="assessmentType"
              value="self"
              checked={assessmentType === "self"}
              onChange={() => setAssessmentType("self")}
              aria-label="Self assessment"
              data-testid="assessment-type-self"
            />
            Self assessment
          </span>
          <span className="text-xs text-muted-foreground">
            Internal maturity snapshot. Complete directly; does not create an
            official published result.
          </span>
        </label>
        <label className="flex cursor-pointer flex-col gap-1 rounded-md border border-border p-3 has-[:checked]:border-accent">
          <span className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name="assessmentType"
              value="formal"
              checked={assessmentType === "formal"}
              onChange={() => setAssessmentType("formal")}
              aria-label="Formal assessment"
              data-testid="assessment-type-formal"
            />
            Formal assessment
          </span>
          <span className="text-xs text-muted-foreground">
            Controlled assessment with assessor review, approval and optional
            official publication.
          </span>
        </label>
      </fieldset>

      {assessmentType === "formal" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="leadAssessorMembershipId">Lead assessor</Label>
          <select
            id="leadAssessorMembershipId"
            name="leadAssessorMembershipId"
            required
            className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
            value={leadAssessorMembershipId}
            onChange={(event) =>
              setLeadAssessorMembershipId(event.target.value)
            }
            data-testid="lead-assessor-select"
          >
            <option value="" disabled>
              {people.length === 0
                ? "No people available in the current site scope"
                : "Select lead assessor"}
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Assigned from the site/organisation People directory. Self
            assessments do not require a lead assessor.
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={
          pending ||
          !unitId ||
          (assessmentType === "formal" && !leadAssessorMembershipId)
        }
      >
        {pending ? "Starting…" : "Start assessment"}
      </Button>
    </form>
  );
}
