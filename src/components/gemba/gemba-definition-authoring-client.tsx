"use client";

import { useState } from "react";

import { DialogServerActionForm } from "@/components/ui/dialog-server-action-form";

import {
  addGembaQuestionFromForm,
  addGembaSectionFromForm,
  setGembaDefinitionApplicableUnitsFromForm,
} from "@/app/(platform)/platform/gemba/actions";
import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

const APPLICABILITY_DESCRIPTION =
  "Choose which organisational units can run walks from this definition.";

export function GembaApplicabilityEditor({
  definitionId,
  configurationUnits,
  applicabilitySelection,
  staleWarning,
}: {
  definitionId: string;
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
        data-testid="gemba-edit-applicability-open"
        onClick={() => setOpen(true)}
      >
        Edit applicable areas
      </Button>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Applicable areas"
        testId="gemba-applicability-dialog"

        enableGuard
      >
        <DialogServerActionForm
          action={setGembaDefinitionApplicableUnitsFromForm}
          className="flex flex-col gap-4"
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="definitionId" value={definitionId} />
          <ApplicableUnitsField
            options={configurationUnits.units}
            selectedIds={applicabilitySelection.selectedIds}
            preservedIds={applicabilitySelection.preservedIds}
            staleWarning={staleWarning}
            staleWarningTestId="gemba-stale-applicability-warning"
            requiresSiteSelection={configurationUnits.requiresSiteSelection}
            description={APPLICABILITY_DESCRIPTION}
          />
          <Button
            type="submit"
            className="min-h-11"
            disabled={
              configurationUnits.units.length === 0 &&
              applicabilitySelection.preservedIds.length === 0
            }
            data-testid="save-gemba-applicability"
          >
            Save applicable areas
          </Button>
        </DialogServerActionForm>
      </ResponsiveFormDialog>
    </>
  );
}

export function GembaDraftAuthoringPanels({
  definitionId,
  versionId,
  sections,
}: {
  definitionId: string;
  versionId: string;
  sections: Array<{
    id: string;
    title: string;
    questions: Array<{ id: string; prompt: string }>;
  }>;
}) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [promptSectionId, setPromptSectionId] = useState<string | null>(null);

  return (
    <>
      <Button
        type="button"
        className="min-h-11"
        data-testid="gemba-add-section-open"
        onClick={() => setSectionOpen(true)}
      >
        Add section
      </Button>

      <ResponsiveFormDialog
        open={sectionOpen}
        onOpenChange={setSectionOpen}
        title="Add section"
        testId="gemba-add-section-dialog"

        enableGuard
      >
        <DialogServerActionForm
          action={addGembaSectionFromForm}
          className="flex flex-col gap-4"
          onSuccess={() => setSectionOpen(false)}
        >
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="definitionId" value={definitionId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="gemba-section-title-dialog">Section title</Label>
            <Input
              id="gemba-section-title-dialog"
              name="sectionTitle"
              required
              className="min-h-11"
              data-testid="gemba-section-title"
            />
          </div>
          <Button type="submit" className="min-h-11">
            Add section
          </Button>
        </DialogServerActionForm>
      </ResponsiveFormDialog>

      <ResponsiveFormDialog
        open={promptSectionId != null}
        onOpenChange={(next) => {
          if (!next) setPromptSectionId(null);
        }}
        title="Add walk prompt"
        testId="gemba-add-prompt-dialog"

        enableGuard
      >
        {promptSectionId ? (
          <DialogServerActionForm
            action={addGembaQuestionFromForm}
            className="flex flex-col gap-4"
            onSuccess={() => setPromptSectionId(null)}
          >
            <input type="hidden" name="versionId" value={versionId} />
            <input type="hidden" name="sectionId" value={promptSectionId} />
            <input type="hidden" name="definitionId" value={definitionId} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="gemba-question-prompt-dialog">Walk prompt</Label>
              <Input
                id="gemba-question-prompt-dialog"
                name="prompt"
                required
                className="min-h-11"
                data-testid="gemba-question-prompt"
              />
            </div>
            <Button type="submit" className="min-h-11">
              Add prompt
            </Button>
          </DialogServerActionForm>
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
              data-testid={`gemba-add-prompt-open-${section.id}`}
              onClick={() => setPromptSectionId(section.id)}
            >
              Add prompt
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No walk prompts in this section yet.
            </p>
          )}
        </div>
      ))}
    </>
  );
}
