"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createOnboardingJobFunction,
  removeOnboardingJobFunction,
  skipStructureFirstStep,
  updateOnboardingJobFunction,
} from "@/app/onboarding/setup/actions";
import { StructureFirstGuidance } from "@/components/onboarding/structure-first-guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hardNavigate } from "@/lib/navigation/navigate";
import { suggestOrganisationUnitCode } from "@/modules/organisation-setup/unit-code";
import {
  unusedJobFunctionSuggestions,
  type StructureFirstJobFunction,
  type StructureGuidance,
} from "@/modules/organisation-onboarding";

export function JobFunctionsSetupStep({
  jobFunctions,
  canManage,
  guidance,
}: {
  jobFunctions: StructureFirstJobFunction[];
  canManage: boolean;
  guidance: readonly StructureGuidance[];
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const existingCodes = useMemo(
    () => jobFunctions.map((jobFunction) => jobFunction.code),
    [jobFunctions],
  );
  const suggestions = unusedJobFunctionSuggestions(existingCodes);

  function handleNameChange(value: string) {
    setName(value);
    setCode(suggestOrganisationUnitCode(value, existingCodes));
  }

  function handleCreate(next?: {
    name: string;
    code: string;
    description?: string;
  }) {
    const payload = next ?? {
      name: name.trim(),
      code: code.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    if (!payload.name || !payload.code) {
      setMessage("Enter a job function name and code.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await createOnboardingJobFunction(payload);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setName("");
      setCode("");
      setDescription("");
      setSaved(true);
    });
  }

  function handleSkip() {
    startTransition(async () => {
      const result = await skipStructureFirstStep("job_functions");
      if (result.error) {
        setMessage(result.error);
        return;
      }
      hardNavigate("/onboarding/setup?step=people");
    });
  }

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="structure-first-job-functions-step"
      aria-labelledby="job-functions-heading"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Job functions
        </p>
        <h2 id="job-functions-heading" className="typography-page-title">
          What do people actually do?
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Job functions describe work. Access roles remain separate and control
          what somebody is allowed to do in Lean Excellence Hub.
        </p>
      </div>

      <StructureFirstGuidance items={guidance} />

      {canManage && suggestions.length > 0 ? (
        <div data-testid="structure-first-job-suggestions">
          <p className="text-sm font-medium text-foreground">Suggestions</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Examples only. Add them if they reflect your organisation.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion.code}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  handleCreate({
                    name: suggestion.name,
                    code: suggestion.code,
                    description: suggestion.description,
                  })
                }
                data-testid={`structure-first-job-suggestion-${suggestion.code}`}
              >
                {suggestion.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {canManage ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          data-testid="structure-first-job-function-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <div className="sm:col-span-1">
            <Label htmlFor="onboarding-jf-name">Name</Label>
            <Input
              id="onboarding-jf-name"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              className="mt-1"
              placeholder="Production Manager"
              required
            />
          </div>
          <div>
            <Label htmlFor="onboarding-jf-code">Code</Label>
            <Input
              id="onboarding-jf-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="onboarding-jf-description">
              Description (optional)
            </Label>
            <Input
              id="onboarding-jf-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add job function"}
            </Button>
          </div>
        </form>
      ) : null}

      {saved ? (
        <p className="text-sm text-success" role="status">
          Job function saved.
        </p>
      ) : null}

      <ul
        className="flex flex-col gap-2"
        data-testid="structure-first-job-function-list"
      >
        {jobFunctions.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            No job functions yet. This step can be skipped.
          </li>
        ) : (
          jobFunctions.map((jobFunction) => (
            <li
              key={jobFunction.id}
              className="rounded-md border border-border px-3 py-3"
              data-testid={`job-function-item-${jobFunction.code}`}
            >
              {editingId === jobFunction.id ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startTransition(async () => {
                      const result = await updateOnboardingJobFunction({
                        jobFunctionId: jobFunction.id,
                        name: editName,
                        description: editDescription,
                      });
                      if (result.error) {
                        setMessage(result.error);
                        return;
                      }
                      setEditingId(null);
                    });
                  }}
                >
                  <Label htmlFor={`edit-jf-${jobFunction.id}`}>Name</Label>
                  <Input
                    id={`edit-jf-${jobFunction.id}`}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                  <Input
                    aria-label="Description"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={pending}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {jobFunction.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {jobFunction.code}
                    </p>
                    {jobFunction.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {jobFunction.description}
                      </p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(jobFunction.id);
                          setEditName(jobFunction.name);
                          setEditDescription(jobFunction.description ?? "");
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await removeOnboardingJobFunction(
                              jobFunction.id,
                            );
                            if (result.error) {
                              setMessage(result.error);
                            }
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))
        )}
      </ul>

      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={() => hardNavigate("/onboarding/setup?step=people")}
          data-testid="structure-first-continue-job-functions"
        >
          Continue to people
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSkip}
          disabled={pending}
          data-testid="structure-first-skip-job-functions"
        >
          Skip for now
        </Button>
      </div>
    </section>
  );
}
