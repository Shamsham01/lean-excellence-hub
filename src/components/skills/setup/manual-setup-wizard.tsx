"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createManualSkillsSetupDraft,
  saveSkillsSetupPreparation,
} from "@/app/(platform)/platform/skills/setup/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  duplicateSkillNames,
  skillNameWarning,
} from "@/modules/skills/setup/name-warning";
import type { ManualSkillsPreparation } from "@/modules/skills/setup/preparation";
import { describeRequirementApplicability } from "@/modules/skills/setup/definition";

import { SkillsTerminologyNote } from "./skills-terminology";

const STEPS = ["scale", "skills", "requirements", "preview"] as const;

type Named = { id: string; name: string };

export function ManualSkillsSetupWizard({
  initial,
  jobFunctions,
  units,
  existingSkillNames,
}: {
  initial: ManualSkillsPreparation;
  jobFunctions: Named[];
  units: Named[];
  existingSkillNames: string[];
}) {
  const [state, setState] = useState(initial);
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const stepIndex = Math.max(0, STEPS.indexOf(state.step));

  const warnings = useMemo(
    () =>
      state.skills.map((skill) =>
        skillNameWarning(
          skill.name,
          jobFunctions.map((jobFunction) => jobFunction.name),
        ),
      ),
    [jobFunctions, state.skills],
  );
  const duplicates = duplicateSkillNames(
    state.skills.map((skill) => skill.name),
    existingSkillNames,
  );

  function persist(next: ManualSkillsPreparation) {
    setState(next);
    setError(null);
    startTransition(async () => {
      const result = await saveSkillsSetupPreparation({
        source: "manual",
        state: next,
      });
      if ("error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  function addBulk() {
    const rows = bulk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, category, evidence] = line
          .split("|")
          .map((part) => part.trim());
        return {
          name: name ?? "",
          category: category ?? "",
          evidence: evidence ?? "",
        };
      });
    if (rows.length === 0) {
      return;
    }
    persist({
      ...state,
      skills: [
        ...state.skills.filter((skill) => skill.name.trim()),
        ...rows,
      ].slice(0, 24),
    });
    setBulk("");
  }

  return (
    <form
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-manual-setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) {
          return;
        }
        const publish =
          (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
            "value",
          ) === "publish";
        const data = new FormData();
        if (publish) {
          data.set("publish", "1");
        }
        startTransition(async () => {
          const saved = await saveSkillsSetupPreparation({
            source: "manual",
            state,
          });
          if ("error" in saved && saved.error) {
            setError(saved.error);
            return;
          }
          const result = await createManualSkillsSetupDraft(data);
          if (result && "error" in result) {
            setError(result.error ?? "The draft could not be created.");
          }
        });
      }}
    >
      <SkillsTerminologyNote />
      <ol
        className="flex flex-wrap gap-2 text-sm"
        data-testid="skills-setup-progress"
      >
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={
              index === stepIndex
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }
          >
            {index + 1}.{" "}
            {step === "scale"
              ? "Scale"
              : step === "skills"
                ? "Skills"
                : step === "requirements"
                  ? "Role requirements"
                  : "Preview"}
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        The catalogue and scale belong to the organisation. Choosing a site in
        the header does not limit them. A requirement applies only where you
        confirm a unit.
      </p>

      {state.step === "scale" ? (
        <fieldset
          className="flex min-w-0 flex-col gap-4"
          data-testid="skills-scale-step"
        >
          <legend className="text-lg font-medium">Proficiency scale</legend>
          <p className="text-sm text-muted-foreground">
            Levels describe demonstrated ability. They are not job titles.
            Example: Aware, Developing, Competent.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="skills-scale-name">Scale name</Label>
            <Input
              id="skills-scale-name"
              data-testid="skills-scale-name"
              value={state.scaleName}
              onChange={(event) =>
                setState({ ...state, scaleName: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="skills-scale-description">
              What the scale means
            </Label>
            <Textarea
              id="skills-scale-description"
              value={state.scaleDescription}
              onChange={(event) =>
                setState({ ...state, scaleDescription: event.target.value })
              }
            />
          </div>
          {state.levels.map((level, index) => (
            <div
              key={level.order}
              className="grid min-w-0 gap-2 sm:grid-cols-2"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={`skills-level-label-${index}`}>
                  Level {index + 1}
                </Label>
                <Input
                  id={`skills-level-label-${index}`}
                  data-testid={`skills-level-label-${index}`}
                  value={level.label}
                  onChange={(event) => {
                    const levels = state.levels.slice();
                    levels[index] = { ...level, label: event.target.value };
                    setState({ ...state, levels });
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`skills-level-guidance-${index}`}>
                  What this level means
                </Label>
                <Input
                  id={`skills-level-guidance-${index}`}
                  value={level.guidance}
                  onChange={(event) => {
                    const levels = state.levels.slice();
                    levels[index] = { ...level, guidance: event.target.value };
                    setState({ ...state, levels });
                  }}
                />
              </div>
            </div>
          ))}
          {state.levels.length < 8 ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() =>
                setState({
                  ...state,
                  levels: [
                    ...state.levels,
                    {
                      order: state.levels.length,
                      label: "",
                      guidance: "",
                    },
                  ],
                })
              }
            >
              Add level
            </Button>
          ) : null}
        </fieldset>
      ) : null}

      {state.step === "skills" ? (
        <fieldset
          className="flex min-w-0 flex-col gap-4"
          data-testid="skills-catalogue-step"
        >
          <legend className="text-lg font-medium">Skills</legend>
          <p className="text-sm text-muted-foreground">
            Enter observable abilities. One skill per line. You can add a
            category and evidence after a vertical bar: Operate and monitor the
            oven | Process | Observed start-up.
          </p>
          <Label htmlFor="skills-bulk-entry">Bulk entry</Label>
          <Textarea
            id="skills-bulk-entry"
            data-testid="skills-bulk-entry"
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={addBulk}
          >
            Add skills from the list
          </Button>
          {duplicates.length > 0 ? (
            <p
              className="text-sm"
              data-testid="skills-duplicate-warning"
              role="status"
            >
              These names match a skill already in this list or the catalogue:{" "}
              {duplicates.join(", ")}. A setup draft reuses an existing skill
              and does not overwrite it.
            </p>
          ) : null}
          {state.skills.map((skill, index) => (
            <div
              key={index}
              className="flex min-w-0 flex-col gap-2 border-t border-border pt-3"
            >
              <Label htmlFor={`skills-skill-name-${index}`}>Skill name</Label>
              <Input
                id={`skills-skill-name-${index}`}
                data-testid={`skills-skill-name-${index}`}
                value={skill.name}
                onChange={(event) => {
                  const skills = state.skills.slice();
                  skills[index] = { ...skill, name: event.target.value };
                  setState({ ...state, skills });
                }}
              />
              {warnings[index] ? (
                <p
                  className="text-sm"
                  data-testid="skills-name-warning"
                  role="status"
                >
                  {warnings[index]}
                </p>
              ) : null}
              <Label htmlFor={`skills-skill-evidence-${index}`}>
                Evidence expectations
              </Label>
              <Input
                id={`skills-skill-evidence-${index}`}
                value={skill.evidence}
                placeholder="What an observer should see. Training attendance is not enough."
                onChange={(event) => {
                  const skills = state.skills.slice();
                  skills[index] = { ...skill, evidence: event.target.value };
                  setState({ ...state, skills });
                }}
              />
            </div>
          ))}
        </fieldset>
      ) : null}

      {state.step === "requirements" ? (
        <fieldset
          className="flex min-w-0 flex-col gap-4"
          data-testid="skills-requirements-step"
        >
          <legend className="text-lg font-medium">Role requirements</legend>
          <p className="text-sm text-muted-foreground">
            Target proficiency is the level that job function must demonstrate.
            It is not the person’s current score. Leave units unset to follow
            the job function across the organisation.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="applicability"
              checked={state.applicability === "organisation"}
              onChange={() =>
                persist({
                  ...state,
                  applicability: "organisation",
                  unitIds: [],
                })
              }
            />
            Apply wherever the job function is used
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="applicability"
              data-testid="skills-applicability-units"
              checked={state.applicability === "units"}
              onChange={() => persist({ ...state, applicability: "units" })}
            />
            Apply only to selected units
          </label>
          {state.applicability === "units" ? (
            <div className="flex flex-col gap-2">
              {units.map((unit) => (
                <label key={unit.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.unitIds.includes(unit.id)}
                    onChange={(event) => {
                      const unitIds = event.target.checked
                        ? [...state.unitIds, unit.id]
                        : state.unitIds.filter((id) => id !== unit.id);
                      persist({ ...state, unitIds });
                    }}
                  />
                  {unit.name}
                </label>
              ))}
            </div>
          ) : null}
          {state.skills
            .filter((skill) => skill.name.trim())
            .map((skill) => {
              const requirement = state.requirements.find(
                (item) =>
                  item.skillName.toLowerCase() ===
                  skill.name.trim().toLowerCase(),
              );
              return (
                <div
                  key={skill.name}
                  className="grid min-w-0 gap-2 border-t border-border pt-3 sm:grid-cols-2"
                >
                  <p className="text-sm font-medium sm:col-span-2">
                    {skill.name}
                  </p>
                  <label className="flex flex-col gap-2 text-sm">
                    Job function
                    <select
                      className="border-input h-10 min-w-0 rounded-md border bg-background px-3"
                      data-testid="skills-requirement-job-function"
                      value={requirement?.jobFunctionId ?? ""}
                      onChange={(event) => {
                        const jobFunctionId = event.target.value;
                        const rest = state.requirements.filter(
                          (item) =>
                            item.skillName.toLowerCase() !==
                            skill.name.trim().toLowerCase(),
                        );
                        if (!jobFunctionId) {
                          persist({ ...state, requirements: rest });
                          return;
                        }
                        persist({
                          ...state,
                          requirements: [
                            ...rest,
                            {
                              skillName: skill.name.trim(),
                              jobFunctionId,
                              levelLabel:
                                requirement?.levelLabel ||
                                state.levels.find((level) => level.label)
                                  ?.label ||
                                "Competent",
                              unitId: null,
                              evidence: skill.evidence,
                            },
                          ],
                        });
                      }}
                    >
                      <option value="">Not required yet</option>
                      {jobFunctions.map((jobFunction) => (
                        <option key={jobFunction.id} value={jobFunction.id}>
                          {jobFunction.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    Target proficiency
                    <select
                      className="border-input h-10 min-w-0 rounded-md border bg-background px-3"
                      data-testid="skills-requirement-level"
                      value={requirement?.levelLabel ?? ""}
                      onChange={(event) => {
                        if (!requirement) {
                          return;
                        }
                        persist({
                          ...state,
                          requirements: state.requirements.map((item) =>
                            item.skillName === requirement.skillName
                              ? { ...item, levelLabel: event.target.value }
                              : item,
                          ),
                        });
                      }}
                    >
                      {state.levels
                        .filter((level) => level.label.trim())
                        .map((level) => (
                          <option key={level.label} value={level.label}>
                            {level.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              );
            })}
        </fieldset>
      ) : null}

      {state.step === "preview" ? (
        <section
          className="flex min-w-0 flex-col gap-3"
          data-testid="skills-preview"
        >
          <h2 className="text-lg font-medium">Preview</h2>
          <p className="text-sm text-muted-foreground">
            Creating the draft does not publish it and does not assess anyone.
            Publishing is a separate action on the draft.
          </p>
          <ul className="flex flex-col gap-3">
            {state.requirements.map((requirement) => {
              const jobFunction = jobFunctions.find(
                (item) => item.id === requirement.jobFunctionId,
              );
              const unit =
                state.applicability === "units"
                  ? units.find((item) => state.unitIds.includes(item.id))
                  : null;
              return (
                <li
                  key={`${requirement.skillName}-${requirement.jobFunctionId}`}
                  className="text-sm"
                >
                  {describeRequirementApplicability({
                    jobFunctionName:
                      jobFunction?.name ?? "The selected job function",
                    skillName: requirement.skillName,
                    levelLabel: requirement.levelLabel,
                    unitName: unit?.name ?? null,
                  })}
                </li>
              );
            })}
          </ul>
          {state.requirements.length === 0 ? (
            <p className="text-sm">
              No role requirements yet. You can still create the scale and
              skills as a draft, then add requirements before publishing.
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p className="text-sm" role="alert" data-testid="skills-setup-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={() =>
              persist({ ...state, step: STEPS[stepIndex - 1] ?? "scale" })
            }
          >
            Back
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          data-testid="skills-save"
          disabled={pending}
          onClick={() => persist(state)}
        >
          Save and resume later
        </Button>
        {state.step !== "preview" ? (
          <Button
            type="button"
            className="w-full sm:w-auto"
            data-testid="skills-next"
            disabled={pending}
            onClick={() =>
              persist({ ...state, step: STEPS[stepIndex + 1] ?? "preview" })
            }
          >
            Continue
          </Button>
        ) : (
          <>
            <Button
              type="submit"
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="skills-create-draft"
              disabled={pending}
              value="draft"
            >
              Create setup draft
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              data-testid="skills-publish-setup"
              disabled={pending}
              value="publish"
            >
              Publish requirements
            </Button>
          </>
        )}
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/skills/matrix">Open skills matrix</AppLink>
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/skills/scales/new">
            Use the detailed editors
          </AppLink>
        </Button>
      </div>
    </form>
  );
}
