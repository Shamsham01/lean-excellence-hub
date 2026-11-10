"use client";

import { useState } from "react";

import {
  addFiveSQuestionFromForm,
  addFiveSSectionFromForm,
  setFiveSStandardApplicableUnitsFromForm,
  setFiveSStandardScoringScaleFromForm,
} from "@/app/(platform)/platform/5s/actions";
import { FiveSScoringScaleFields } from "@/components/five-s/scoring-scale-fields";
import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import type { FiveSScoringScale } from "@/modules/5s/scoring-scale";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

type AuthoringSection = {
  id: string;
  title: string;
  questions: Array<{ id: string; prompt: string; questionType: string }>;
};

function ServerActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        await action(formData);
        onSuccess?.();
      }}
      className={className}
    >
      {children}
    </form>
  );
}

export function FiveSApplicabilityEditor({
  standardId,
  configurationUnits,
  applicabilitySelection,
  staleWarning,
}: {
  standardId: string;
  configurationUnits: {
    units: UnitSelectOption[];
    requiresSiteSelection: boolean;
  };
  applicabilitySelection: {
    selectedIds: ReadonlySet<string>;
    preservedIds: readonly string[];
  };
  staleWarning: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit"
        data-testid="five-s-edit-applicability-open"
        onClick={() => setOpen(true)}
      >
        Edit applicable areas
      </Button>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Applicable areas"
        testId="five-s-applicability-dialog"
      
        enableGuard
      >
        <ServerActionForm
          action={setFiveSStandardApplicableUnitsFromForm}
          className="flex flex-col gap-4"
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="standardId" value={standardId} />
          <ApplicableUnitsField
            options={configurationUnits.units}
            selectedIds={applicabilitySelection.selectedIds}
            preservedIds={applicabilitySelection.preservedIds}
            staleWarning={staleWarning}
            requiresSiteSelection={configurationUnits.requiresSiteSelection}
          />
          <Button
            type="submit"
            className="min-h-11"
            disabled={
              configurationUnits.units.length === 0 &&
              applicabilitySelection.preservedIds.length === 0
            }
            data-testid="save-five-s-applicability"
          >
            Save applicable areas
          </Button>
        </ServerActionForm>
      </ResponsiveFormDialog>
    </>
  );
}

export function FiveSScoringScaleEditor({
  standardId,
  versionId,
  initial,
  saved,
}: {
  standardId: string;
  versionId: string;
  initial: FiveSScoringScale | null;
  saved: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit"
        data-testid="five-s-edit-scoring-scale-open"
        onClick={() => setOpen(true)}
      >
        Edit scoring scale
      </Button>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Scoring scale"
        testId="five-s-scoring-scale-dialog"
        contentClassName="sm:max-w-xl"
      
        enableGuard
      >
        <ServerActionForm
          action={setFiveSStandardScoringScaleFromForm}
          className="flex flex-col gap-4"
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="standardId" value={standardId} />
          <FiveSScoringScaleFields
            initial={initial}
            saved={saved}
            idPrefix={`draft-scale-${versionId}`}
          />
          <Button
            type="submit"
            className="min-h-11"
            data-testid="save-five-s-scoring-scale"
          >
            Save scoring scale
          </Button>
        </ServerActionForm>
      </ResponsiveFormDialog>
    </>
  );
}

export function FiveSDraftAuthoringPanels({
  standardId,
  versionId,
  sections,
  questionTypeLabel,
}: {
  standardId: string;
  versionId: string;
  sections: AuthoringSection[];
  questionTypeLabel: (value: string) => string;
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [questionSectionId, setQuestionSectionId] = useState<string | null>(
    null,
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          data-testid="five-s-add-category-open"
          onClick={() => setCategoryOpen(true)}
        >
          Add category
        </Button>
      </div>

      <ResponsiveFormDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title="Add category"
        testId="five-s-add-category-dialog"
      
        enableGuard
      >
        <ServerActionForm
          action={addFiveSSectionFromForm}
          className="flex flex-col gap-4"
          onSuccess={() => setCategoryOpen(false)}
        >
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="standardId" value={standardId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="sectionTitle">Category name</Label>
            <Input
              id="sectionTitle"
              name="sectionTitle"
              required
              className="min-h-11"
            />
          </div>
          <Button type="submit" className="min-h-11">
            Add category
          </Button>
        </ServerActionForm>
      </ResponsiveFormDialog>

      <ResponsiveFormDialog
        open={questionSectionId != null}
        onOpenChange={(next) => {
          if (!next) setQuestionSectionId(null);
        }}
        title="Add question"
        testId="five-s-add-question-dialog"
      
        enableGuard
      >
        {questionSectionId ? (
          <ServerActionForm
            action={addFiveSQuestionFromForm}
            className="flex flex-col gap-4"
            onSuccess={() => setQuestionSectionId(null)}
          >
            <input type="hidden" name="versionId" value={versionId} />
            <input type="hidden" name="sectionId" value={questionSectionId} />
            <input type="hidden" name="standardId" value={standardId} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="five-s-question-prompt-dialog">Question</Label>
              <Input
                id="five-s-question-prompt-dialog"
                name="prompt"
                required
                className="min-h-11"
                data-testid="five-s-question-prompt"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="five-s-question-type-dialog">Type</Label>
              <select
                id="five-s-question-type-dialog"
                name="questionType"
                className="min-h-11 rounded-md border border-border px-3"
              >
                <option value="yes_no">Yes / No</option>
                <option value="score">Score</option>
                <option value="short_text">Text</option>
              </select>
            </div>
            <Button type="submit" className="min-h-11">
              Add question
            </Button>
          </ServerActionForm>
        ) : null}
      </ResponsiveFormDialog>

      {sections.map((section) => (
        <div
          key={section.id}
          className="rounded-lg border border-border p-4"
          data-testid="authoring-section"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{section.title}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              data-testid={`five-s-add-question-open-${section.id}`}
              onClick={() => setQuestionSectionId(section.id)}
            >
              Add question
            </Button>
          </div>
          {section.questions.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {section.questions.map((question) => (
                <li
                  key={question.id}
                  className="rounded-md border border-border bg-surface px-3 py-2"
                  data-testid="authoring-question"
                >
                  <p className="font-medium">{question.prompt}</p>
                  <p className="text-sm text-muted-foreground">
                    {questionTypeLabel(question.questionType)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No questions in this category yet.
            </p>
          )}
        </div>
      ))}
    </>
  );
}
