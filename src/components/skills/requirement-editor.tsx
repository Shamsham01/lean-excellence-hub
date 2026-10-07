"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addSkillRequirement,
  publishSkillsStandard,
} from "@/app/(platform)/platform/skills/actions";
import {
  skillsControlClass,
  SkillsFieldError,
} from "@/components/skills/skills-field";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };
type LevelOption = {
  id: string;
  label: string;
  order: number;
  scaleVersionId: string;
  scaleName: string;
};
type UnitOption = { id: string; name: string };
type RequirementRow = {
  id: string;
  skillName: string;
  jobFunctionName: string;
  levelLabel: string;
  mandatory: boolean;
  evidenceRequirement: string | null;
  unitName: string | null;
};

export function RequirementEditor({
  versionId,
  skills,
  jobFunctions,
  levels,
  units,
  requirements,
  hasPublishedScale,
  scaleHref,
}: {
  versionId: string;
  skills: Option[];
  jobFunctions: Option[];
  levels: LevelOption[];
  units: UnitOption[];
  requirements: RequirementRow[];
  hasPublishedScale: boolean;
  scaleHref: string;
}) {
  const router = useRouter();
  const [skillId, setSkillId] = useState("");
  const [jobFunctionId, setJobFunctionId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState<"add" | "publish" | null>(null);

  const selectedLevel = levels.find((level) => level.id === levelId);
  const scaleGroups = useMemo(() => {
    const groups = new Map<string, { name: string; levels: LevelOption[] }>();
    for (const level of levels) {
      const group = groups.get(level.scaleVersionId) ?? {
        name: level.scaleName,
        levels: [],
      };
      group.levels.push(level);
      groups.set(level.scaleVersionId, group);
    }
    return [...groups.entries()];
  }, [levels]);

  const canAdd =
    hasPublishedScale &&
    skills.length > 0 &&
    jobFunctions.length > 0 &&
    levels.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="typography-section-title">Requirements</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Each requirement connects a job function to a skill and the level
          someone in that job function needs. Saved requirements stay on this
          draft.
        </p>
        {requirements.length === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="standard-requirements-empty"
          >
            No requirements yet.
          </p>
        ) : (
          <ol
            className="flex flex-col gap-3"
            data-testid="standard-requirements"
          >
            {requirements.map((requirement) => (
              <li
                key={requirement.id}
                className="grid gap-1 border-t border-border pt-3 text-sm"
              >
                <p className="font-medium">
                  {requirement.jobFunctionName} → {requirement.skillName}
                </p>
                <p className="text-muted-foreground">
                  Required level: {requirement.levelLabel}
                  {requirement.mandatory ? " · Mandatory" : " · Optional"}
                  {requirement.unitName ? ` · ${requirement.unitName}` : ""}
                </p>
                {requirement.evidenceRequirement ? (
                  <p className="text-muted-foreground">
                    Evidence: {requirement.evidenceRequirement}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {jobFunctions.length === 0 ? (
        <p
          className="text-sm"
          data-testid="standard-job-functions-prerequisite"
        >
          Create job functions before assigning capability requirements.{" "}
          <AppLink
            href="/platform/settings/job-functions"
            className="text-primary hover:underline"
          >
            Open job functions
          </AppLink>
        </p>
      ) : null}
      {!hasPublishedScale ? (
        <p className="text-sm" data-testid="standard-scale-prerequisite">
          Publish a proficiency scale before choosing a required level.{" "}
          <AppLink href={scaleHref} className="text-primary hover:underline">
            Open proficiency scales
          </AppLink>
        </p>
      ) : null}
      {skills.length === 0 ? (
        <p className="text-sm" data-testid="standard-skills-prerequisite">
          Create at least one skill before assigning requirements.{" "}
          <AppLink
            href="/platform/skills/catalog?new=1"
            className="text-primary hover:underline"
          >
            Create skill
          </AppLink>
        </p>
      ) : null}

      {canAdd ? (
        <form
          className="flex min-w-0 flex-col gap-4"
          data-testid="requirement-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending || !selectedLevel) {
              setError("Choose a job function, skill, and required level.");
              return;
            }

            setPending("add");
            setError(null);
            setFeedback(null);
            void addSkillRequirement({
              capabilitySetVersionId: versionId,
              skillId,
              jobFunctionId,
              scaleVersionId: selectedLevel.scaleVersionId,
              levelId,
              mandatory,
              ...(unitId ? { organisationalUnitId: unitId } : {}),
              ...(evidence.trim()
                ? { evidenceRequirement: evidence.trim() }
                : {}),
            })
              .then((result) => {
                if ("error" in result) {
                  setError(result.error);
                  setPending(null);
                  return;
                }

                setSkillId("");
                setLevelId("");
                setEvidence("");
                setFeedback("Requirement saved.");
                setPending(null);
                router.refresh();
              })
              .catch(() => {
                setError("Unable to add this capability requirement.");
                setPending(null);
              });
          }}
        >
          <h2 className="typography-section-title">Add requirement</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="requirement-job-function">Job function</Label>
              <select
                id="requirement-job-function"
                className={skillsControlClass}
                required
                value={jobFunctionId}
                onChange={(event) => setJobFunctionId(event.target.value)}
                data-testid="requirement-job-function"
              >
                <option value="">Select job function</option>
                {jobFunctions.map((jobFunction) => (
                  <option key={jobFunction.id} value={jobFunction.id}>
                    {jobFunction.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="requirement-skill">Skill</Label>
              <select
                id="requirement-skill"
                className={skillsControlClass}
                required
                value={skillId}
                onChange={(event) => setSkillId(event.target.value)}
                data-testid="requirement-skill"
              >
                <option value="">Select skill</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="requirement-level">Required level</Label>
            <select
              id="requirement-level"
              className={skillsControlClass}
              required
              value={levelId}
              onChange={(event) => setLevelId(event.target.value)}
              data-testid="requirement-level"
            >
              <option value="">Select required level</option>
              {scaleGroups.map(([scaleVersionId, group]) => (
                <optgroup key={scaleVersionId} label={group.name}>
                  {group.levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.order} — {level.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="requirement-mandatory"
              type="checkbox"
              className="size-4"
              checked={mandatory}
              onChange={(event) => setMandatory(event.target.checked)}
              data-testid="requirement-mandatory"
            />
            <Label htmlFor="requirement-mandatory">Mandatory</Label>
          </div>
          {units.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Limit to a unit (optional)
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                <Label htmlFor="requirement-unit">Organisational unit</Label>
                <select
                  id="requirement-unit"
                  className={skillsControlClass}
                  value={unitId}
                  onChange={(event) => setUnitId(event.target.value)}
                  data-testid="requirement-unit"
                >
                  <option value="">Any unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
            </details>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="requirement-evidence">
              Evidence requirement{" "}
              <span className="font-normal">(optional)</span>
            </Label>
            <Textarea
              id="requirement-evidence"
              rows={2}
              maxLength={2000}
              value={evidence}
              placeholder="Practical observation"
              onChange={(event) => setEvidence(event.target.value)}
              data-testid="requirement-evidence"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={pending !== null}
            data-testid="requirement-add"
          >
            {pending === "add" ? "Saving requirement…" : "Save requirement"}
          </Button>
        </form>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="typography-section-title">Publish</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Publishing makes these requirements visible on the skills matrix for
          people whose primary job function matches.
        </p>
        <Button
          type="button"
          className="self-start"
          disabled={pending !== null || requirements.length === 0}
          data-testid="standard-publish"
          onClick={() => {
            setPending("publish");
            setError(null);
            setFeedback(null);
            void publishSkillsStandard({ versionId })
              .then((result) => {
                if ("error" in result) {
                  setError(result.error);
                  setPending(null);
                  return;
                }

                setFeedback("Skills standard published.");
                setPending(null);
                router.refresh();
              })
              .catch(() => {
                setError("Unable to publish this skills standard.");
                setPending(null);
              });
          }}
        >
          {pending === "publish" ? "Publishing…" : "Publish skills standard"}
        </Button>
      </section>

      {error ? (
        <SkillsFieldError testId="requirement-error">{error}</SkillsFieldError>
      ) : null}
      {feedback ? (
        <p className="text-sm" data-testid="skills-authoring-feedback">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
