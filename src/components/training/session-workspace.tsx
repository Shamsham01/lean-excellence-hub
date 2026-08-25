"use client";

import { useState } from "react";

import {
  addSessionParticipant,
  removeSessionParticipant,
  updateSessionParticipantStatus,
} from "@/app/(platform)/platform/training/actions";
import { BulkCompletionDialog } from "@/components/training/bulk-completion-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type ParticipantRow = {
  id: string;
  membership_id: string;
  display_name: string;
  status: string;
};

type SessionWorkspaceProps = {
  sessionId: string;
  sessionTitle: string;
  courseName: string;
  courseVersionLabel: string;
  courseVersionId: string;
  canManage: boolean;
  canComplete: boolean;
  participants: ParticipantRow[];
  availableMemberships: Array<{ id: string; label: string }>;
};

const statusOptions = [
  "invited",
  "attended",
  "completed",
  "absent",
  "cancelled",
] as const;

export function SessionWorkspace({
  sessionId,
  sessionTitle,
  courseName,
  courseVersionLabel,
  courseVersionId,
  canManage,
  canComplete,
  participants,
  availableMemberships,
}: SessionWorkspaceProps) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addMembershipId, setAddMembershipId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAddParticipant() {
    if (!addMembershipId) return;
    setError(null);
    const result = await addSessionParticipant(sessionId, addMembershipId);
    if (result.error) setError(result.error);
    else setAddMembershipId("");
  }

  return (
    <div className="space-y-6" data-testid="session-workspace">
      {canManage ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="add-participant">Add participant</Label>
            <select
              id="add-participant"
              className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm"
              value={addMembershipId}
              onChange={(e) => setAddMembershipId(e.target.value)}
              data-testid="add-participant-select"
            >
              <option value="">Select person…</option>
              {availableMemberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleAddParticipant}
          >
            Add
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">Participants</h2>
          {canComplete ? (
            <Button
              size="sm"
              onClick={() => setBulkOpen(true)}
              data-testid="open-bulk-completion"
            >
              Bulk completion
            </Button>
          ) : null}
        </div>
        <ul className="divide-y divide-border">
          {participants.map((participant) => (
            <li
              key={participant.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{participant.display_name}</p>
                <Badge variant="outline" className="mt-1">
                  {participant.status}
                </Badge>
              </div>
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="min-h-9 rounded-md border border-border bg-elevated px-2 text-sm"
                    value={participant.status}
                    onChange={async (e) => {
                      await updateSessionParticipantStatus(
                        sessionId,
                        participant.id,
                        e.target.value,
                      );
                    }}
                    aria-label={`Status for ${participant.display_name}`}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      removeSessionParticipant(sessionId, participant.id)
                    }
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
          {participants.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              No participants yet.
            </li>
          ) : null}
        </ul>
      </div>

      <BulkCompletionDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        courseName={courseName}
        courseVersionLabel={courseVersionLabel}
        courseVersionId={courseVersionId}
        participants={participants}
      />
    </div>
  );
}
