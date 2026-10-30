"use client";

import { useMemo, useState, useTransition } from "react";

import { useSerializedSetupSave } from "@/components/skills/setup/serialized-save";

import {
  createQuickStartSkillsDraft,
  saveSkillsSetupPreparation,
  startNewSkillsSetup,
} from "@/app/(platform)/platform/skills/setup/actions";
import { Button } from "@/components/ui/button";
import { buildStarterPackDefinition } from "@/modules/skills/setup/definition";
import { describeRequirementApplicability } from "@/modules/skills/setup/definition";
import type { QuickStartPreparation } from "@/modules/skills/setup/preparation";
import {
  skillsSetupSelectClass,
  skillsSetupWrappingTextClass,
  type SkillsSetupUnitOption,
} from "@/modules/skills/setup/unit-options";
import type { SkillsStarterPack } from "@/modules/skills/templates/types";

type Named = { id: string; name: string };

export function SkillsQuickStartForm({
  pack,
  initial,
  jobFunctions,
  units,
}: {
  pack: SkillsStarterPack;
  initial: QuickStartPreparation;
  jobFunctions: Named[];
  units: SkillsSetupUnitOption[];
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const enqueue = useSerializedSetupSave();
  const preview = useMemo(() => {
    return buildStarterPackDefinition({
      pack,
      applicability: state.applicability,
      unitIds: state.unitIds,
      roleMappings: state.roleMappings,
      scaleResolution: state.scaleResolution,
    });
  }, [pack, state]);

  function persist(next: QuickStartPreparation) {
    setState(next);
    setError(null);
    startTransition(async () => {
      await enqueue(async () => {
        const result = await saveSkillsSetupPreparation({
          source: "quick_start",
          templateKey: pack.key,
          state: next,
        });
        if ("error" in result && result.error) {
          setError(result.error);
        }
      });
    });
  }

  return (
    <form
      className="flex w-full max-w-full min-w-0 flex-col gap-6"
      data-testid="skills-quick-start-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) {
          return;
        }
        const data = new FormData();
        data.set("templateKey", pack.key);
        startTransition(async () => {
          await enqueue(async () => {
            const saved = await saveSkillsSetupPreparation({
              source: "quick_start",
              templateKey: pack.key,
              state,
            });
            if ("error" in saved && saved.error) {
              setError(saved.error);
              return;
            }
            const result = await createQuickStartSkillsDraft(data);
            if (result && "error" in result && result.error) {
              setError(result.error);
            }
          });
        });
      }}
    >
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight">{pack.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{pack.summary}</p>
        {pack.disclaimer ? (
          <p className="mt-3 text-sm" data-testid="skills-pack-disclaimer">
            {pack.disclaimer}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Sample content. Publishing is a later, explicit step. Installing
            this pack does not assess anyone.
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          Where requirements apply
        </legend>
        <p className="text-sm text-muted-foreground">
          The catalogue is organisation-wide. This choice only limits the
          requirements.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            checked={state.applicability === "organisation"}
            onChange={() =>
              persist({ ...state, applicability: "organisation", unitIds: [] })
            }
          />
          Wherever the mapped job function is used
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            data-testid="skills-quick-start-units"
            checked={state.applicability === "units"}
            onChange={() => persist({ ...state, applicability: "units" })}
          />
          Only the units I select
        </label>
        {state.applicability === "units" ? (
          <div
            className="flex w-full max-w-full min-w-0 flex-col gap-2"
            data-testid="skills-unit-list"
          >
            {units.map((unit) => (
              <label
                key={unit.id}
                className="flex min-h-11 w-full max-w-full min-w-0 items-start gap-2 py-2 pl-6 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0"
                  checked={state.unitIds.includes(unit.id)}
                  onChange={(event) => {
                    const unitIds = event.target.checked
                      ? [...state.unitIds, unit.id]
                      : state.unitIds.filter((id) => id !== unit.id);
                    persist({ ...state, unitIds });
                  }}
                />
                <span className={skillsSetupWrappingTextClass}>
                  {unit.path}
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

      <fieldset
        className="flex min-w-0 flex-col gap-3"
        data-testid="skills-role-mapping"
      >
        <legend className="text-sm font-medium">
          Map suggested roles to job functions
        </legend>
        <p className="text-sm text-muted-foreground">
          Suggested roles are job functions, not skills. Unmapped roles are
          skipped. Existing job functions are not renamed.
        </p>
        {pack.suggestedRoles.map((role) => {
          const current = state.roleMappings.find(
            (mapping) => mapping.suggestedRole === role.title,
          );
          return (
            <label
              key={role.title}
              className="grid w-full max-w-full min-w-0 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
            >
              <span className={skillsSetupWrappingTextClass}>
                <span className="font-medium">{role.title}</span>
                <span className="mt-1 block text-muted-foreground">
                  {role.summary}
                </span>
              </span>
              <select
                className={skillsSetupSelectClass}
                data-testid={`skills-map-${role.title}`}
                value={current?.jobFunctionId ?? ""}
                onChange={(event) => {
                  const jobFunctionId = event.target.value || null;
                  const roleMappings = state.roleMappings.map((mapping) =>
                    mapping.suggestedRole === role.title
                      ? { ...mapping, jobFunctionId }
                      : mapping,
                  );
                  persist({ ...state, roleMappings });
                }}
              >
                <option value="">Do not create requirements</option>
                {jobFunctions.map((jobFunction) => (
                  <option key={jobFunction.id} value={jobFunction.id}>
                    {jobFunction.name}
                  </option>
                ))}
              </select>
              {current?.jobFunctionId ? (
                <span
                  className={`sm:col-start-2 ${skillsSetupWrappingTextClass}`}
                  data-testid={`skills-selected-${role.title}`}
                >
                  {
                    jobFunctions.find(
                      (jobFunction) => jobFunction.id === current.jobFunctionId,
                    )?.name
                  }
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      <section
        className="flex flex-col gap-2"
        data-testid="skills-quick-start-preview"
      >
        <h3 className="text-base font-medium">
          What will be created or reused
        </h3>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            Scale: {pack.scaleName}. Levels:{" "}
            {pack.levels.map((level) => level.label).join(", ")}.
          </li>
          <li>
            Sample skills: {pack.skills.map((skill) => skill.name).join("; ")}.
          </li>
          {preview.ok
            ? preview.definition.requirements.map((requirement) => {
                const skill = preview.definition.skills.find(
                  (item) => item.code === requirement.skill_code,
                );
                const jobFunction = jobFunctions.find(
                  (item) => item.id === requirement.job_function_id,
                );
                const unit = units.find(
                  (item) => item.id === requirement.organisational_unit_id,
                );
                return (
                  <li
                    key={`${requirement.skill_code}-${requirement.job_function_id}-${requirement.organisational_unit_id}`}
                    className={skillsSetupWrappingTextClass}
                  >
                    {describeRequirementApplicability({
                      jobFunctionName:
                        jobFunction?.name ?? "Mapped job function",
                      skillName: skill?.name ?? requirement.skill_code,
                      levelLabel: requirement.level_label,
                      unitName: unit?.path ?? null,
                    })}
                  </li>
                );
              })
            : null}
          {preview.ok && preview.definition.unresolved_roles.length > 0 ? (
            <li>
              Not created until you map them:{" "}
              {preview.definition.unresolved_roles
                .map((role) => role.suggested_role)
                .join(", ")}
              .
            </li>
          ) : null}
        </ul>
        {!preview.ok ? <p className="text-sm">{preview.message}</p> : null}
      </section>

      {error ? (
        <p
          className={`text-sm ${skillsSetupWrappingTextClass}`}
          role="alert"
          data-testid="skills-setup-error"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="submit"
          className="w-full max-w-full whitespace-normal sm:w-auto"
          data-testid="skills-create-setup-draft"
          disabled={pending || !preview.ok}
        >
          Create setup draft
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full max-w-full whitespace-normal sm:w-auto"
          data-testid="skills-start-new-setup"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await enqueue(async () => {
                const result = await startNewSkillsSetup({
                  source: "quick_start",
                  templateKey: pack.key,
                  state,
                });
                if ("error" in result && result.error) {
                  setError(result.error);
                  return;
                }
                if ("preparation" in result) {
                  setState(result.preparation);
                }
              });
            });
          }}
        >
          Start a new setup
        </Button>
      </div>
    </form>
  );
}
