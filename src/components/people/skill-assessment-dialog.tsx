"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  initiateSkillAssessmentEvidence,
  confirmSkillAssessmentEvidence,
  recordSkillValidation,
  recordSkillSelfAssessment,
} from "@/app/(platform)/platform/people/actions";
import { EvidenceUploader } from "@/components/attachments/evidence-uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type GapRow = {
  skill_id: string;
  skill_name: string;
  gap: {
    status?: string;
    current_order?: number;
    target_order?: number;
    scale_version_id?: string;
    target_scale_version_id?: string;
  };
};

type ProficiencyLevel = {
  id: string;
  order_value: number;
  label: string;
  scale_version_id: string;
};

type SkillAssessmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  displayName: string;
  gaps: GapRow[];
  levels: ProficiencyLevel[];
  mode: "validation" | "self";
  initialSkillId?: string;
};

const validationMethods = [
  "manager_assessment",
  "observation",
  "portfolio_review",
  "certification",
  "practical_test",
] as const;

export function SkillAssessmentDialog({
  open,
  onOpenChange,
  membershipId,
  displayName,
  gaps,
  levels,
  mode,
  initialSkillId,
}: SkillAssessmentDialogProps) {
  const router = useRouter();
  const assessableGaps = useMemo(
    () =>
      gaps.filter(
        (g) =>
          g.gap?.status === "below_requirement" ||
          g.gap?.status === "not_assessed" ||
          g.gap?.status === "incompatible_scale",
      ),
    [gaps],
  );

  const [skillId, setSkillId] = useState(initialSkillId ?? "");
  const [levelId, setLevelId] = useState("");
  const [method, setMethod] = useState<string>("manager_assessment");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  const selectedGap = assessableGaps.find((g) => g.skill_id === skillId);
  const scaleVersionId =
    selectedGap?.gap?.scale_version_id ??
    selectedGap?.gap?.target_scale_version_id ??
    null;
  const availableLevels = levels
    .filter((l) => l.scale_version_id === scaleVersionId)
    .sort((a, b) => a.order_value - b.order_value);

  const targetOrder = selectedGap?.gap?.target_order;
  const currentOrder = selectedGap?.gap?.current_order;

  function reset() {
    setSkillId(initialSkillId ?? "");
    setLevelId("");
    setMethod("manager_assessment");
    setNotes("");
    setValidUntil("");
    setPending(false);
    setError(null);
    setAssessmentId(null);
  }

  async function handleSave() {
    if (!skillId || !levelId || !scaleVersionId) {
      setError("Select a skill and proficiency level.");
      return;
    }

    setPending(true);
    setError(null);

    const payload = {
      membershipId,
      skillId,
      proficiencyScaleVersionId: scaleVersionId,
      proficiencyLevelId: levelId,
      ...(notes ? { notes } : {}),
      ...(mode === "validation"
        ? {
            assessmentMethod: method,
            ...(validUntil
              ? { validUntil: new Date(validUntil).toISOString() }
              : {}),
          }
        : {}),
    };

    const result =
      mode === "self"
        ? await recordSkillSelfAssessment(payload)
        : await recordSkillValidation(payload);

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.assessmentId) {
      setAssessmentId(result.assessmentId);
      router.refresh();
      return;
    }

    onOpenChange(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) reset();
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        data-testid="skill-assessment-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "self" ? "Self assessment" : "Skill assessment"}
          </DialogTitle>
          <DialogDescription>
            {mode === "self"
              ? "Record your self-assessed proficiency. Validation remains separate."
              : "Record validated proficiency for an authorised person."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Person:</span>{" "}
              {displayName}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-select">Skill</Label>
            <select
              id="skill-select"
              className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm"
              value={skillId}
              onChange={(e) => {
                setSkillId(e.target.value);
                setLevelId("");
              }}
              data-testid="skill-assessment-skill"
            >
              <option value="">Select skill…</option>
              {assessableGaps.map((gap) => (
                <option key={gap.skill_id} value={gap.skill_id}>
                  {gap.skill_name}
                </option>
              ))}
            </select>
          </div>

          {selectedGap ? (
            <div className="grid gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Required:</span>{" "}
                {targetOrder ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">
                  Current validated:
                </span>{" "}
                {currentOrder ?? "Not assessed"}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="level-select">Selected proficiency</Label>
            <select
              id="level-select"
              className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              data-testid="skill-assessment-level"
            >
              <option value="">Select level…</option>
              {availableLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label} ({level.order_value})
                </option>
              ))}
            </select>
          </div>

          {mode === "validation" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="method-select">Assessment method</Label>
                <select
                  id="method-select"
                  className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  data-testid="skill-assessment-method"
                >
                  {validationMethods.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid-until">Valid until (optional)</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  data-testid="skill-assessment-valid-until"
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="assessment-notes">Notes</Label>
            <Textarea
              id="assessment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="skill-assessment-notes"
            />
          </div>

          {assessmentId ? (
            <div className="space-y-2">
              <Label>Evidence (optional)</Label>
              <EvidenceUploader
                existingEvidence={[]}
                canEdit
                onInitiate={async (filename, mimeType, byteSize) =>
                  initiateSkillAssessmentEvidence(
                    assessmentId,
                    filename,
                    mimeType,
                    byteSize,
                  )
                }
                onConfirm={confirmSkillAssessmentEvidence}
                onLink={async (attachmentId) => {
                  const linkResult =
                    await confirmSkillAssessmentEvidence(attachmentId);
                  return linkResult.error ? { error: linkResult.error } : {};
                }}
              />
              <p className="text-xs text-muted-foreground">
                Evidence links to this assessment record only.
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {assessmentId ? "Done" : "Cancel"}
          </Button>
          {!assessmentId ? (
            <Button
              onClick={handleSave}
              disabled={pending}
              data-testid="skill-assessment-save"
            >
              {pending ? "Saving…" : "Save assessment"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
