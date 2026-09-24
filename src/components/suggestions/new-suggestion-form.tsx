"use client";

import { useRef, useState } from "react";

import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SuggestionEvidencePicker,
  SuggestionEvidenceValidationAlert,
} from "@/components/suggestions/suggestion-evidence-picker";
import { EVIDENCE_BUCKET } from "@/lib/attachments/evidence-file-rules";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  createBrowserSuggestionEvidenceClient,
  createSuggestionEvidenceFile,
  submitSuggestionWithEvidence,
  type SuggestionDraftFields,
  type SuggestionEvidenceFile,
} from "@/lib/suggestions/submit-suggestion-with-evidence";
import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

type ProgrammeVersion = { id: string; programme_name: string };
type Category = { id: string; name: string };

type PrimaryUnitState = {
  hasPrimaryUnit: boolean;
  canManageAssignment: boolean;
  membershipId?: string;
  unitName?: string;
};

type NewSuggestionFormProps = {
  programmeVersions: ProgrammeVersion[];
  categories: Category[];
  primaryUnit: PrimaryUnitState;
  canManageProgrammes: boolean;
};

function buildConfigurationMessage(
  programmeVersions: ProgrammeVersion[],
  categories: Category[],
) {
  const missingProgramme = programmeVersions.length === 0;
  const missingCategories = categories.length === 0;

  if (missingProgramme && missingCategories) {
    return "Suggestion submission is not available yet because your organisation has not configured a suggestion programme or categories.";
  }

  if (missingProgramme) {
    return "Suggestion submission is not available yet because your organisation has not configured a suggestion programme.";
  }

  return "Suggestion submission is not available yet because your organisation has not configured suggestion categories.";
}

function toSubmissionErrorMessage(error: unknown, fallback: string): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: string }).message)
      : typeof error === "string"
        ? error
        : "";
  const normalised = raw.toLowerCase();

  if (normalised.includes("file type or size is not allowed")) {
    return "That file type or size is not allowed. Use a PDF, JPEG, PNG, WebP, or plain-text file up to 10 MB.";
  }

  if (
    normalised.includes("attachment upload is not authorised") ||
    normalised.includes("attachment confirmation is not authorised")
  ) {
    return "You do not have permission to attach evidence to this idea.";
  }

  if (normalised.includes("some evidence could not be attached")) {
    return raw;
  }

  if (
    normalised.includes("your idea was saved, but it could not be submitted")
  ) {
    return raw;
  }

  if (
    normalised.includes("suggestion evidence withdraw is not authorised") ||
    normalised.includes("suggestion evidence cannot be withdrawn")
  ) {
    return "Unable to remove that file from the idea. It is still attached.";
  }

  return toCustomerErrorMessage(error, fallback);
}

function readDraftFields(
  programmeVersionId: string,
  categoryId: string,
  title: string,
  noticed: string,
  proposed: string,
  benefit: string,
): SuggestionDraftFields {
  return {
    programmeVersionId,
    categoryId,
    title,
    noticed,
    proposed,
    benefit,
  };
}

export function NewSuggestionForm({
  programmeVersions,
  categories,
  primaryUnit,
  canManageProgrammes,
}: NewSuggestionFormProps) {
  const [programmeVersionId, setProgrammeVersionId] = useState(
    programmeVersions[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [noticed, setNoticed] = useState("");
  const [proposed, setProposed] = useState("");
  const [benefit, setBenefit] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [files, setFiles] = useState<SuggestionEvidenceFile[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lockedCatalogue, setLockedCatalogue] = useState<{
    programmeVersionId: string;
    categoryId: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const hasProgrammeConfiguration =
    programmeVersions.length > 0 && categories.length > 0;
  const canSubmit = hasProgrammeConfiguration && primaryUnit.hasPrimaryUnit;
  const hasFailedEvidence = files.some((file) => file.status === "failed");

  const blockedMessage = !primaryUnit.hasPrimaryUnit
    ? primaryUnit.canManageAssignment && primaryUnit.membershipId
      ? "Your organisation assignment is incomplete. Assign your primary work area before submitting an idea."
      : "Your organisation assignment is incomplete. Ask an administrator to assign your primary work area before submitting an idea."
    : null;

  const configurationMessage = !hasProgrammeConfiguration
    ? buildConfigurationMessage(programmeVersions, categories)
    : null;

  function addSelectedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const nextMessages: string[] = [];
    const accepted: SuggestionEvidenceFile[] = [];

    Array.from(fileList).forEach((file) => {
      const created = createSuggestionEvidenceFile(file);
      if ("error" in created) {
        nextMessages.push(created.error);
        return;
      }
      accepted.push(created);
    });

    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
    }
    setValidationMessages(nextMessages);
    setError(null);
  }

  async function removeFile(clientId: string) {
    const selected = files.find((file) => file.clientId === clientId);
    if (!selected) {
      return;
    }

    if (selected.attachmentId) {
      const supabase = createBrowserSupabaseClient();
      const client = createBrowserSuggestionEvidenceClient(
        async (fn, args) => {
          const { data, error } = await supabase.rpc(
            fn as never,
            args as never,
          );
          return { data, error };
        },
        async () => undefined,
      );

      try {
        await client.withdrawEvidence(selected.attachmentId);
      } catch (withdrawError) {
        setError(
          toSubmissionErrorMessage(
            withdrawError,
            "Unable to remove that file from the idea. It is still attached.",
          ),
        );
        return;
      }
    }

    setFiles((current) => current.filter((file) => file.clientId !== clientId));
    setValidationMessages([]);
    setError(null);
  }

  async function submitIdea() {
    if (submittingRef.current) {
      return;
    }

    if (!primaryUnit.hasPrimaryUnit) {
      setError(blockedMessage);
      return;
    }

    if (!programmeVersionId) {
      setError("Select a programme");
      return;
    }

    if (!categoryId) {
      setError("Select a category");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);
    setValidationMessages([]);

    const supabase = createBrowserSupabaseClient();
    const client = createBrowserSuggestionEvidenceClient(
      async (fn, args) => {
        const { data, error } = await supabase.rpc(fn as never, args as never);
        return { data, error };
      },
      async (storagePath, file) => {
        const { error: storageError } = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .upload(storagePath, file, { upsert: false });
        if (storageError) throw storageError;
      },
    );

    const catalogue = lockedCatalogue ?? {
      programmeVersionId,
      categoryId,
    };

    try {
      const result = await submitSuggestionWithEvidence(client, {
        fields: readDraftFields(
          catalogue.programmeVersionId,
          catalogue.categoryId,
          title,
          noticed,
          proposed,
          benefit,
        ),
        draftId,
        files,
      });

      if (result.ok === false) {
        if (result.draftId) {
          setDraftId(result.draftId);
          setLockedCatalogue(catalogue);
        }
        setFiles(result.files);
        setError(
          toSubmissionErrorMessage(
            { message: result.error },
            "Unable to submit your idea. Check your details and try again.",
          ),
        );
        return;
      }

      // NAV-CLICK-001: do not pair router.push with router.refresh — the
      // refresh cancels the in-flight destination on compiled/hosted servers.
      navigateTo(`/platform/suggestions/${result.suggestionId}`);
    } catch (err) {
      setError(
        toSubmissionErrorMessage(
          err,
          "Unable to submit your idea. Check your details and try again.",
        ),
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submitIdea();
  }

  return (
    <Card data-testid="new-suggestion-form">
      <CardHeader>
        <CardTitle>Share an improvement idea</CardTitle>
      </CardHeader>

      <CardContent>
        {configurationMessage ? (
          <div
            className="mb-4 rounded-md border border-border bg-muted/40 p-4 text-sm"
            data-testid="suggestion-configuration-block"
          >
            <p className="text-foreground">{configurationMessage}</p>
            {canManageProgrammes ? (
              <Button asChild variant="outline" size="sm" className="mt-3">
                <AppLink
                  href="/platform/suggestions/programmes"
                  data-testid="suggestion-configure-programmes-link"
                >
                  Configure suggestion programmes
                </AppLink>
              </Button>
            ) : null}
          </div>
        ) : null}

        {!canSubmit && hasProgrammeConfiguration ? (
          <div
            className="mb-4 rounded-md border border-border bg-muted/40 p-4 text-sm"
            data-testid="suggestion-prerequisite-block"
          >
            <p className="text-foreground">{blockedMessage}</p>
            {primaryUnit.canManageAssignment && primaryUnit.membershipId ? (
              <Button asChild variant="outline" size="sm" className="mt-3">
                <AppLink
                  href={`/platform/people/${primaryUnit.membershipId}/admin`}
                  data-testid="suggestion-assign-work-area-link"
                >
                  Assign my primary work area
                </AppLink>
              </Button>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>What have you noticed?</span>
            <textarea
              required
              rows={3}
              className="border-input min-h-[88px] rounded-md border bg-background px-3 py-2"
              value={noticed}
              onChange={(e) => setNoticed(e.target.value)}
              disabled={!canSubmit || loading}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>What would you change?</span>
            <textarea
              required
              rows={3}
              className="border-input min-h-[88px] rounded-md border bg-background px-3 py-2"
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
              disabled={!canSubmit || loading}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Short title (optional)</span>
            <input
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canSubmit || loading}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Programme</span>
            <select
              required
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              value={lockedCatalogue?.programmeVersionId ?? programmeVersionId}
              onChange={(e) => setProgrammeVersionId(e.target.value)}
              disabled={
                programmeVersions.length === 0 ||
                !canSubmit ||
                loading ||
                lockedCatalogue != null
              }
            >
              {programmeVersions.length === 0 ? (
                <option value="">No programmes available</option>
              ) : (
                programmeVersions.map((pv) => (
                  <option key={pv.id} value={pv.id}>
                    {pv.programme_name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Category</span>
            <select
              required
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              value={lockedCatalogue?.categoryId ?? categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={
                categories.length === 0 ||
                !canSubmit ||
                loading ||
                lockedCatalogue != null
              }
            >
              {categories.length === 0 ? (
                <option value="">No categories available</option>
              ) : (
                categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Expected benefit (optional)</span>
            <textarea
              rows={2}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
              disabled={!canSubmit || loading}
            />
          </label>

          {lockedCatalogue ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="suggestion-catalogue-locked"
            >
              Programme and category stay as first saved so a retry cannot
              submit a different selection from the one shown.
            </p>
          ) : null}

          <SuggestionEvidencePicker
            files={files}
            disabled={!canSubmit || loading}
            onAddFiles={addSelectedFiles}
            onRemove={(clientId) => {
              void removeFile(clientId);
            }}
            onRetry={() => {
              void submitIdea();
            }}
          />

          <SuggestionEvidenceValidationAlert messages={validationMessages} />

          {error ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="suggestion-submit-error"
            >
              {error}
            </p>
          ) : null}

          {hasFailedEvidence ? (
            <p className="text-sm text-muted-foreground">
              Remove a failed file to continue without it, or retry the upload.
              The idea will not be submitted while a selected file has failed.
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={loading || !canSubmit || hasFailedEvidence}
            className="min-h-11"
            data-testid="suggestion-submit-button"
          >
            {loading ? "Submitting…" : "Submit idea"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
