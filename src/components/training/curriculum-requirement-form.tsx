"use client";

import { OrganisationalUnitSelect } from "@/components/organisation/organisational-unit-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  describeTrainingCourseValidity,
  describeTrainingRequirementApplicability,
  type TrainingRequirementApplicabilityMode,
} from "@/modules/training/curriculum-admin";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

export type CurriculumRequirementFormValues = {
  courseId: string;
  applicabilityMode: TrainingRequirementApplicabilityMode;
  jobFunctionId: string;
  organisationalUnitId: string;
  mandatory: boolean;
  requiredWithinDays: string;
  validityDaysOverride: string;
  gracePeriodDays: string;
  notes: string;
};

export type CurriculumNamedOption = {
  id: string;
  name: string;
};

export type CurriculumCourseOption = CurriculumNamedOption & {
  validityDays: number | null;
};

export function emptyRequirementFormValues(): CurriculumRequirementFormValues {
  return {
    courseId: "",
    applicabilityMode: "all_members",
    jobFunctionId: "",
    organisationalUnitId: "",
    mandatory: true,
    requiredWithinDays: "",
    validityDaysOverride: "",
    gracePeriodDays: "",
    notes: "",
  };
}

const SELECT_CLASS_NAME =
  "border-input min-h-11 w-full rounded-md border bg-elevated px-3 py-2 text-sm";

type CurriculumRequirementFormProps = {
  values: CurriculumRequirementFormValues;
  courses: readonly CurriculumCourseOption[];
  jobFunctions: readonly CurriculumNamedOption[];
  units: readonly UnitSelectOption[];
  onChange: (values: CurriculumRequirementFormValues) => void;
  disabled?: boolean;
};

export function CurriculumRequirementForm({
  values,
  courses,
  jobFunctions,
  units,
  onChange,
  disabled = false,
}: CurriculumRequirementFormProps) {
  const selectedCourse = courses.find(
    (course) => course.id === values.courseId,
  );
  const selectedJobFunction = jobFunctions.find(
    (jobFunction) => jobFunction.id === values.jobFunctionId,
  );
  const selectedUnit = units.find(
    (unit) => unit.id === values.organisationalUnitId,
  );
  const overrideDays = values.validityDaysOverride.trim()
    ? Number(values.validityDaysOverride)
    : null;

  function update<K extends keyof CurriculumRequirementFormValues>(
    field: K,
    value: CurriculumRequirementFormValues[K],
  ) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="training-requirement-form"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="training-requirement-course">Course</Label>
        <select
          id="training-requirement-course"
          className={SELECT_CLASS_NAME}
          value={values.courseId}
          disabled={disabled}
          onChange={(event) => update("courseId", event.target.value)}
          data-testid="training-requirement-course-input"
        >
          <option value="">Select a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {describeTrainingCourseValidity({
            courseValidityDays: selectedCourse?.validityDays ?? null,
            overrideDays:
              overrideDays != null && Number.isInteger(overrideDays)
                ? overrideDays
                : null,
          })}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Who this applies to</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="training-requirement-applicability"
            value="all_members"
            checked={values.applicabilityMode === "all_members"}
            disabled={disabled}
            onChange={() =>
              onChange({
                ...values,
                applicabilityMode: "all_members",
                jobFunctionId: "",
                organisationalUnitId: "",
              })
            }
            data-testid="training-requirement-applicability-all-members"
          />
          Everyone in the organisation
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="training-requirement-applicability"
            value="job_function"
            checked={values.applicabilityMode === "job_function"}
            disabled={disabled}
            onChange={() =>
              onChange({
                ...values,
                applicabilityMode: "job_function",
                organisationalUnitId: "",
              })
            }
            data-testid="training-requirement-applicability-job-function"
          />
          People with a job function
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input
            type="radio"
            name="training-requirement-applicability"
            value="job_function_and_unit"
            className="mt-2"
            checked={values.applicabilityMode === "job_function_and_unit"}
            disabled={disabled}
            onChange={() =>
              onChange({
                ...values,
                applicabilityMode: "job_function_and_unit",
              })
            }
            data-testid="training-requirement-applicability-job-function-and-unit"
          />
          <span>
            Job function, with an organisational unit recorded for applicability
          </span>
        </label>
        <p
          className="text-xs text-muted-foreground"
          data-testid="training-requirement-applicability-help"
        >
          {describeTrainingRequirementApplicability({
            appliesToAllMembers: values.applicabilityMode === "all_members",
            jobFunctionName: selectedJobFunction?.name,
            organisationalUnitName:
              values.applicabilityMode === "job_function_and_unit"
                ? selectedUnit?.name
                : null,
          })}
        </p>
      </fieldset>

      {values.applicabilityMode !== "all_members" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="training-requirement-job-function">
            Job function
          </Label>
          <select
            id="training-requirement-job-function"
            className={SELECT_CLASS_NAME}
            value={values.jobFunctionId}
            disabled={disabled}
            onChange={(event) => update("jobFunctionId", event.target.value)}
            data-testid="training-requirement-job-function-input"
          >
            <option value="">Select a job function</option>
            {jobFunctions.map((jobFunction) => (
              <option key={jobFunction.id} value={jobFunction.id}>
                {jobFunction.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {values.applicabilityMode === "job_function_and_unit" ? (
        <OrganisationalUnitSelect
          id="training-requirement-unit"
          label="Organisational unit"
          options={[...units]}
          value={values.organisationalUnitId}
          onChange={(unitId) => update("organisationalUnitId", unitId)}
          disabled={disabled}
          placeholderLabel="Select an organisational unit"
          emptyMessage="No organisational units are available in this organisation."
          testId="training-requirement-unit-input"
        />
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Requirement status</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="training-requirement-mandatory"
            checked={values.mandatory}
            disabled={disabled}
            onChange={() => update("mandatory", true)}
            data-testid="training-requirement-mandatory"
          />
          Mandatory
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="training-requirement-mandatory"
            checked={!values.mandatory}
            disabled={disabled}
            onChange={() => update("mandatory", false)}
            data-testid="training-requirement-optional"
          />
          Optional
        </label>
        <p className="text-xs text-muted-foreground">
          Current compliance calculations count mandatory requirements only.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="training-requirement-deadline">
            Completion deadline (days)
          </Label>
          <Input
            id="training-requirement-deadline"
            type="number"
            min={1}
            inputMode="numeric"
            value={values.requiredWithinDays}
            disabled={disabled}
            onChange={(event) =>
              update("requiredWithinDays", event.target.value)
            }
            data-testid="training-requirement-deadline-input"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="training-requirement-validity-override">
            Validity override (days)
          </Label>
          <Input
            id="training-requirement-validity-override"
            type="number"
            min={1}
            inputMode="numeric"
            value={values.validityDaysOverride}
            disabled={disabled}
            onChange={(event) =>
              update("validityDaysOverride", event.target.value)
            }
            data-testid="training-requirement-validity-override-input"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="training-requirement-grace">
            Grace period (days)
          </Label>
          <Input
            id="training-requirement-grace"
            type="number"
            min={0}
            inputMode="numeric"
            value={values.gracePeriodDays}
            disabled={disabled}
            onChange={(event) => update("gracePeriodDays", event.target.value)}
            data-testid="training-requirement-grace-input"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="training-requirement-notes">
          Notes <span className="font-normal">(optional)</span>
        </Label>
        <Textarea
          id="training-requirement-notes"
          rows={3}
          value={values.notes}
          disabled={disabled}
          placeholder="Any extra guidance for this requirement."
          onChange={(event) => update("notes", event.target.value)}
          data-testid="training-requirement-notes-input"
        />
      </div>
    </div>
  );
}
