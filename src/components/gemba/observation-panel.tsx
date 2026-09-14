"use client";

import { useEffect, useRef, useState } from "react";

import {
  createGembaObservation,
  deleteGembaObservation,
  deleteGembaObservations,
  updateGembaObservation,
} from "@/app/(platform)/platform/gemba/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { GembaEvidenceBlock } from "@/components/gemba/gemba-evidence-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  formatGembaObservationType,
  gembaObservationTypeOptions,
  isGembaObservationType,
  type GembaObservationType,
} from "@/modules/operational/gemba-display";

export type WalkObservation = {
  id: string;
  observation_text: string;
  observation_type: string;
};

export type ObservationIntegrity = {
  dirty: boolean;
  busy: boolean;
  error: boolean;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type GembaObservationPanelProps = {
  walkId: string;
  observations: WalkObservation[];
  evidence: EvidenceItem[];
  canEdit: boolean;
  onIntegrityChange?: (integrity: ObservationIntegrity) => void;
};

const CREATE_ERROR_MESSAGE = "Couldn't save this observation. Try again.";
const UPDATE_ERROR_MESSAGE = "Couldn't update this observation. Try again.";
const DELETE_ERROR_MESSAGE = "Couldn't delete this observation. Try again.";
const EMPTY_TEXT_MESSAGE = "Enter observation text before saving.";

function isMutationSuccess(result: unknown) {
  if (!result || typeof result !== "object") return false;
  const record = result as {
    ok?: unknown;
    error?: unknown;
    observationId?: unknown;
  };
  if (record.error != null) return false;
  return record.ok === true || typeof record.observationId === "string";
}

export function GembaObservationPanel({
  walkId,
  observations,
  evidence,
  canEdit,
  onIntegrityChange,
}: GembaObservationPanelProps) {
  const [items, setItems] = useState(observations);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<GembaObservationType | null>(
    null,
  );
  const [draftText, setDraftText] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] =
    useState<GembaObservationType>("positive_practice");
  const [editStatus, setEditStatus] = useState<SaveStatus>("idle");
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(
    null,
  );
  const [deleteStatus, setDeleteStatus] = useState<SaveStatus>("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const createLockRef = useRef(false);
  const editLockRef = useRef(false);
  const deleteLockRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);
  const observationsFingerprint = JSON.stringify(observations);
  const [syncedFingerprint, setSyncedFingerprint] = useState(
    observationsFingerprint,
  );
  if (syncedFingerprint !== observationsFingerprint) {
    setSyncedFingerprint(observationsFingerprint);
    setItems(observations);
  }

  const dirty = captureOpen || editingId != null;
  const busy =
    saveStatus === "saving" ||
    editStatus === "saving" ||
    deleteStatus === "saving";
  const error = saveStatus === "error" || editStatus === "error";

  useEffect(() => {
    onIntegrityChange?.({ dirty, busy, error });
  }, [busy, dirty, error, onIntegrityChange]);

  function resetCapture() {
    createLockRef.current = false;
    requestIdRef.current = null;
    setCaptureOpen(false);
    setSelectedType(null);
    setDraftText("");
    setSaveStatus("idle");
    setSaveError(null);
  }

  function openCapture() {
    if (!canEdit || busy) return;
    setEditingId(null);
    setCaptureOpen(true);
    setSaveStatus("idle");
    setSaveError(null);
    setNotice(null);
  }

  function chooseType(type: GembaObservationType) {
    if (!canEdit || createLockRef.current) return;
    setCaptureOpen(true);
    setSelectedType(type);
    setSaveStatus("idle");
    setSaveError(null);
    setNotice(null);
  }

  async function handleCreate() {
    if (!canEdit || createLockRef.current) return;
    if (!selectedType) {
      setSaveStatus("error");
      setSaveError("Choose an observation type.");
      return;
    }
    if (!draftText.trim()) {
      setSaveStatus("error");
      setSaveError(EMPTY_TEXT_MESSAGE);
      return;
    }

    createLockRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);
    requestIdRef.current ??= crypto.randomUUID();

    try {
      const result = await createGembaObservation(
        walkId,
        draftText,
        selectedType,
        requestIdRef.current,
      );
      if (!isMutationSuccess(result)) {
        setSaveStatus("error");
        setSaveError(
          typeof result.error === "string"
            ? result.error
            : CREATE_ERROR_MESSAGE,
        );
        return;
      }

      const observationId = result.observationId as string;
      setItems((current) => {
        if (current.some((item) => item.id === observationId)) return current;
        return [
          ...current,
          {
            id: observationId,
            observation_text: draftText.trim(),
            observation_type: selectedType,
          },
        ];
      });
      setSaveStatus("saved");
      setNotice("Observation saved.");
      requestIdRef.current = null;
      setCaptureOpen(false);
      setSelectedType(null);
      setDraftText("");
    } catch {
      setSaveStatus("error");
      setSaveError(CREATE_ERROR_MESSAGE);
    } finally {
      createLockRef.current = false;
    }
  }

  function startEdit(observation: WalkObservation) {
    if (!canEdit || busy) return;
    resetCapture();
    setEditingId(observation.id);
    setEditText(observation.observation_text);
    setEditType(
      isGembaObservationType(observation.observation_type)
        ? observation.observation_type
        : "issue",
    );
    setEditStatus("idle");
    setEditError(null);
    setNotice(null);
  }

  function cancelEdit() {
    editLockRef.current = false;
    setEditingId(null);
    setEditText("");
    setEditStatus("idle");
    setEditError(null);
  }

  async function handleUpdate() {
    if (!canEdit || !editingId || editLockRef.current) return;
    if (!editText.trim()) {
      setEditStatus("error");
      setEditError(EMPTY_TEXT_MESSAGE);
      return;
    }

    editLockRef.current = true;
    setEditStatus("saving");
    setEditError(null);

    try {
      const result = await updateGembaObservation(
        walkId,
        editingId,
        editText,
        editType,
      );
      if (!isMutationSuccess(result)) {
        setEditStatus("error");
        setEditError(
          typeof result.error === "string"
            ? result.error
            : UPDATE_ERROR_MESSAGE,
        );
        return;
      }

      const nextId = editingId;
      const nextText = editText.trim();
      const nextType = editType;
      setItems((current) =>
        current.map((item) =>
          item.id === nextId
            ? {
                ...item,
                observation_text: nextText,
                observation_type: nextType,
              }
            : item,
        ),
      );
      setEditStatus("saved");
      setNotice("Observation updated.");
      setEditingId(null);
    } catch {
      setEditStatus("error");
      setEditError(UPDATE_ERROR_MESSAGE);
    } finally {
      editLockRef.current = false;
    }
  }

  function toggleSelected(observationId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, observationId])]
        : current.filter((id) => id !== observationId),
    );
  }

  function requestDelete(observationIds: string[]) {
    if (!canEdit || observationIds.length === 0) return;
    setPendingDeleteIds(observationIds);
    setDeleteError(null);
    setDeleteStatus("idle");
  }

  async function confirmDelete() {
    if (!canEdit || !pendingDeleteIds || deleteLockRef.current) return;
    deleteLockRef.current = true;
    setDeleteStatus("saving");
    setDeleteError(null);

    try {
      const result =
        pendingDeleteIds.length === 1
          ? await deleteGembaObservation(walkId, pendingDeleteIds[0]!)
          : await deleteGembaObservations(walkId, pendingDeleteIds);

      if (!isMutationSuccess(result) && result.error) {
        setDeleteStatus("error");
        setDeleteError(
          typeof result.error === "string"
            ? result.error
            : DELETE_ERROR_MESSAGE,
        );
        return;
      }

      const removed = new Set(pendingDeleteIds);
      setItems((current) => current.filter((item) => !removed.has(item.id)));
      setSelectedIds((current) => current.filter((id) => !removed.has(id)));
      if (editingId && removed.has(editingId)) {
        cancelEdit();
      }
      setPendingDeleteIds(null);
      setDeleteStatus("idle");
      setNotice(
        pendingDeleteIds.length > 1
          ? "Selected observations deleted."
          : "Observation deleted.",
      );
    } catch {
      setDeleteStatus("error");
      setDeleteError(DELETE_ERROR_MESSAGE);
    } finally {
      deleteLockRef.current = false;
    }
  }

  const typeOptions = gembaObservationTypeOptions();
  const evidenceCountByObservation = new Map<string, number>();
  for (const item of evidence) {
    if (!item.observation_id) continue;
    evidenceCountByObservation.set(
      item.observation_id,
      (evidenceCountByObservation.get(item.observation_id) ?? 0) + 1,
    );
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6"
      data-testid="gemba-observation-panel"
    >
      <div className="flex flex-col gap-1">
        <h2 className="typography-section-title">Observations</h2>
        <p className="text-sm text-muted-foreground">
          Capture what you see on the floor. Choosing a type does not save until
          you press Save.
        </p>
      </div>

      {notice ? (
        <p
          className="text-sm text-success"
          data-testid="gemba-observation-notice"
        >
          {notice}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-col gap-3">
          {!captureOpen ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={openCapture}
              data-testid="gemba-capture-observation"
            >
              Capture observation
            </Button>
          ) : null}

          {captureOpen ? (
            <div
              className="flex flex-col gap-4 rounded-md border border-border bg-background p-4"
              data-testid="gemba-observation-editor"
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">
                  Observation type
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {typeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={
                        selectedType === option.value ? "default" : "outline"
                      }
                      className="min-h-11 w-full justify-center text-center"
                      aria-pressed={selectedType === option.value}
                      onClick={() => chooseType(option.value)}
                      data-testid={`gemba-observation-type-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </fieldset>

              {selectedType ? (
                <>
                  <div>
                    <Label htmlFor="gemba-observation-text">Observation</Label>
                    <Textarea
                      id="gemba-observation-text"
                      className="mt-2 min-h-24"
                      value={draftText}
                      onChange={(event) => {
                        setDraftText(event.target.value);
                        if (saveStatus === "saved") {
                          setSaveStatus("idle");
                        }
                      }}
                      data-testid="gemba-observation-text"
                    />
                  </div>
                  <div
                    className="flex min-h-6 flex-wrap items-center gap-2"
                    aria-live="polite"
                    data-testid="gemba-observation-save-status"
                  >
                    {saveStatus === "saving" ? (
                      <p className="text-sm text-muted-foreground">Saving…</p>
                    ) : null}
                    {saveStatus === "saved" ? (
                      <p className="text-sm text-success">Saved</p>
                    ) : null}
                    {saveStatus === "error" ? (
                      <p className="text-sm text-destructive" role="alert">
                        {saveError ?? CREATE_ERROR_MESSAGE}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a type, then enter what you observed.
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  disabled={
                    !selectedType ||
                    saveStatus === "saving" ||
                    !draftText.trim()
                  }
                  onClick={() => {
                    void handleCreate();
                  }}
                  data-testid="gemba-observation-save"
                >
                  {saveStatus === "saving" ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1"
                  disabled={saveStatus === "saving"}
                  onClick={resetCapture}
                  data-testid="gemba-observation-cancel"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {canEdit && selectedIds.length > 0 ? (
        <Button
          type="button"
          variant="destructive"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => requestDelete(selectedIds)}
          data-testid="gemba-delete-selected"
        >
          Delete selected ({selectedIds.length})
        </Button>
      ) : null}

      {deleteError && !pendingDeleteIds ? (
        <p className="text-sm text-destructive" role="alert">
          {deleteError}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3" data-testid="gemba-observation-list">
        {items.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            No observations captured yet.
          </li>
        ) : (
          items.map((observation) => {
            const evidenceCount =
              evidenceCountByObservation.get(observation.id) ?? 0;
            const editing = editingId === observation.id;
            return (
              <li
                key={observation.id}
                className="rounded-md border border-border bg-background p-3"
                data-testid={`gemba-observation-card-${observation.id}`}
              >
                <div className="flex items-start gap-3">
                  {canEdit ? (
                    <Checkbox
                      className="mt-1"
                      checked={selectedIds.includes(observation.id)}
                      onCheckedChange={(value) =>
                        toggleSelected(observation.id, value === true)
                      }
                      aria-label={`Select ${formatGembaObservationType(observation.observation_type)} observation`}
                      data-testid={`gemba-observation-select-${observation.id}`}
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {formatGembaObservationType(
                          observation.observation_type,
                        )}
                      </Badge>
                      {evidenceCount > 0 ? (
                        <span
                          className="text-xs text-muted-foreground"
                          data-testid={`gemba-observation-evidence-count-${observation.id}`}
                        >
                          {evidenceCount} evidence
                        </span>
                      ) : null}
                    </div>

                    {editing ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          {typeOptions.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              variant={
                                editType === option.value
                                  ? "default"
                                  : "outline"
                              }
                              className="min-h-11"
                              onClick={() => setEditType(option.value)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                        <Textarea
                          className="min-h-24"
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          data-testid="gemba-observation-edit-text"
                        />
                        <div
                          className="flex min-h-6 flex-wrap items-center gap-2"
                          aria-live="polite"
                          data-testid="gemba-observation-edit-status"
                        >
                          {editStatus === "saving" ? (
                            <p className="text-sm text-muted-foreground">
                              Saving…
                            </p>
                          ) : null}
                          {editStatus === "error" ? (
                            <p
                              className="text-sm text-destructive"
                              role="alert"
                            >
                              {editError ?? UPDATE_ERROR_MESSAGE}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            className="min-h-11 flex-1"
                            disabled={editStatus === "saving"}
                            onClick={() => {
                              void handleUpdate();
                            }}
                            data-testid="gemba-observation-edit-save"
                          >
                            {editStatus === "saving" ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 flex-1"
                            disabled={editStatus === "saving"}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {observation.observation_text}
                      </p>
                    )}

                    {canEdit && !editing ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => startEdit(observation)}
                          data-testid={`gemba-observation-edit-${observation.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => requestDelete([observation.id])}
                          data-testid={`gemba-observation-delete-${observation.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}

                    <GembaEvidenceBlock
                      walkId={walkId}
                      observationId={observation.id}
                      evidence={evidence}
                      canEdit={canEdit}
                    />
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <Dialog
        open={pendingDeleteIds != null}
        onOpenChange={(open) => {
          if (!open && deleteStatus !== "saving") {
            setPendingDeleteIds(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingDeleteIds && pendingDeleteIds.length > 1
                ? "Delete selected observations?"
                : "Delete this observation?"}
            </DialogTitle>
            <DialogDescription>
              This removes the observation from the in-progress walk. Linked
              observation evidence is unlinked. Walk attachments are kept.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={deleteStatus === "saving"}
              onClick={() => setPendingDeleteIds(null)}
              data-testid="gemba-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={deleteStatus === "saving"}
              onClick={() => {
                void confirmDelete();
              }}
              data-testid="gemba-confirm-delete"
            >
              {deleteStatus === "saving" ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
