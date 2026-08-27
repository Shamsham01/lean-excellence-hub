"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addSessionEntry,
  completeProblemSolvingSession,
  startProblemSolvingSession,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type SessionsPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  canFacilitate: boolean;
  membershipNameById: Record<string, string>;
};

export function SessionsPanel({
  caseId,
  detail,
  canFacilitate,
  membershipNameById,
}: SessionsPanelProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [entryBodies, setEntryBodies] = useState<
    Record<string, { note: string; decision: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function entriesFor(sessionId: string) {
    return entryBodies[sessionId] ?? { note: "", decision: "" };
  }

  async function handleStart(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const result = await startProblemSolvingSession({
      caseId,
      title: title.trim(),
    });
    setMessage(result.error ?? "Session started");
    setTitle("");
    setLoading(false);
    router.refresh();
  }

  async function handleAddEntry(
    sessionId: string,
    entryType: "note" | "decision",
  ) {
    const body =
      entryType === "note"
        ? entriesFor(sessionId).note
        : entriesFor(sessionId).decision;
    if (!body.trim()) return;
    setLoading(true);
    const result = await addSessionEntry({
      sessionId,
      caseId,
      entryType,
      body: body.trim(),
    });
    setMessage(result.error ?? `${entryType} added`);
    setLoading(false);
    router.refresh();
  }

  async function handleComplete(sessionId: string) {
    setLoading(true);
    const result = await completeProblemSolvingSession(
      sessionId,
      caseId,
      "Session completed from workspace",
    );
    setMessage(result.error ?? "Session completed");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-sessions-panel"
    >
      {canFacilitate ? (
        <Card>
          <CardHeader>
            <CardTitle>Start session</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleStart}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <label className="flex flex-1 flex-col gap-1 text-sm">
                <span>Session title</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="session-title"
                />
              </label>
              <Button type="submit" size="sm" disabled={loading}>
                Start session
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sessions ({detail.sessions.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.sessions.length === 0 ? (
            <p className="text-muted-foreground">No sessions yet.</p>
          ) : (
            detail.sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2"
                data-testid={`session-item-${session.id}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{session.title}</p>
                      <Badge variant="outline">{session.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.participants.length} participants ·{" "}
                      {session.entry_count} entries
                      {session.facilitator_membership_id
                        ? ` · Facilitator ${membershipNameById[session.facilitator_membership_id] ?? "—"}`
                        : ""}
                    </p>
                    {session.summary ? (
                      <p className="mt-1 text-muted-foreground">
                        {session.summary}
                      </p>
                    ) : null}
                  </div>
                  {canFacilitate && session.status !== "completed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => handleComplete(session.id)}
                      data-testid={`complete-session-${session.id}`}
                    >
                      Complete
                    </Button>
                  ) : null}
                </div>
                {canFacilitate && session.status !== "completed" ? (
                  <div className="grid gap-2 border-t border-border pt-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Textarea
                        rows={2}
                        placeholder="Session note"
                        value={entriesFor(session.id).note}
                        onChange={(e) =>
                          setEntryBodies((current) => ({
                            ...current,
                            [session.id]: {
                              ...entriesFor(session.id),
                              note: e.target.value,
                            },
                          }))
                        }
                        data-testid={`session-note-${session.id}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => handleAddEntry(session.id, "note")}
                        data-testid={`add-session-note-${session.id}`}
                      >
                        Add note
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Textarea
                        rows={2}
                        placeholder="Session decision"
                        value={entriesFor(session.id).decision}
                        onChange={(e) =>
                          setEntryBodies((current) => ({
                            ...current,
                            [session.id]: {
                              ...entriesFor(session.id),
                              decision: e.target.value,
                            },
                          }))
                        }
                        data-testid={`session-decision-${session.id}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => handleAddEntry(session.id, "decision")}
                        data-testid={`add-session-decision-${session.id}`}
                      >
                        Add decision
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
