"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  completeAction,
  reopenAction,
  setActionAssignee,
  transitionActionStatus,
  updateActionFields,
} from "@/app/(platform)/platform/actions/actions";
import { ActionEvidenceBlock } from "@/components/actions/action-evidence-block";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import {
  ResourceComments,
  type CommentRow,
} from "@/components/comments/resource-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACTION_PRIORITIES,
  actionPriorityLabel,
  actionStatusBadgeVariant,
  actionStatusLabel,
  dateInputToDueAt,
  formatActionReference,
  formatDueDate,
  isActionEditable,
  toDateInputValue,
} from "@/lib/actions/status";
import type { ActionDetail, AssignablePerson } from "@/lib/actions/types";

function sourceLabel(source: ActionDetail["source"]): string {
  if (!source) return "";
  const reference = source.reference?.trim();
  const title = source.title?.trim();
  if (reference && title) return `${reference} · ${title}`;
  return reference || title || "Source record";
}

export function ActionWorkspace({
  detail,
  comments,
  evidence,
  assignablePeople,
  canUploadEvidence,
}: {
  detail: ActionDetail;
  comments: CommentRow[];
  evidence: EvidenceItem[];
  assignablePeople: AssignablePerson[];
  canUploadEvidence: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description ?? "");
  const [priority, setPriority] = useState(detail.priority);
  const [dueDate, setDueDate] = useState(toDateInputValue(detail.due_at));
  const [assigneeId, setAssigneeId] = useState(
    detail.assignees[0]?.membership_id ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const editable = isActionEditable(detail.status);
  const permissions = detail.permissions;
  const reference = formatActionReference(detail.action_number, detail.title);
  const source = detail.source;
  const currentAssignee = detail.assignees[0];

  async function run(
    key: string,
    task: () => Promise<{ error?: string; ok?: true }>,
  ) {
    setPending(key);
    setError(null);
    setMessage(null);
    const result = await task();
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6" data-testid="action-detail-page">
      <div className="border-b border-border pb-6">
        <p
          className="text-sm font-medium text-muted-foreground"
          data-testid="action-reference"
        >
          {reference}
        </p>
        <h1 className="typography-page-title mt-1">{detail.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            variant={actionStatusBadgeVariant(detail.status)}
            data-testid="action-status"
          >
            {actionStatusLabel(detail.status)}
          </Badge>
          <Badge variant="secondary" data-testid="action-priority">
            {actionPriorityLabel(detail.priority)}
          </Badge>
          {detail.unit_name ? (
            <span className="text-sm text-muted-foreground">
              {detail.unit_name}
            </span>
          ) : null}
          {detail.due_at ? (
            <span className="text-sm text-muted-foreground">
              Due {formatDueDate(detail.due_at)}
            </span>
          ) : null}
        </div>
        {currentAssignee ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Assigned to {currentAssignee.display_name}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Unassigned</p>
        )}
      </div>

      {source ? (
        <Card data-testid="action-source-card">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium">Source</p>
            {source.href ? (
              <Link
                href={source.href}
                className="mt-1 inline-flex text-sm text-primary hover:underline"
                data-testid="action-source-link"
              >
                {sourceLabel(source)}
              </Link>
            ) : (
              <p className="mt-1 text-muted-foreground">
                {sourceLabel(source)}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div
        className="flex flex-wrap gap-2"
        data-testid="action-lifecycle-actions"
      >
        {permissions.can_start && detail.status === "open" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() =>
              run("start", () =>
                transitionActionStatus({
                  actionId: detail.id,
                  toStatus: "in_progress",
                  expectedVersion: detail.version,
                }),
              )
            }
            data-testid="action-start-button"
          >
            {pending === "start" ? "Starting…" : "Start"}
          </Button>
        ) : null}
        {permissions.can_complete &&
        (detail.status === "open" || detail.status === "in_progress") ? (
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() =>
              run("complete", () =>
                completeAction({
                  actionId: detail.id,
                  expectedVersion: detail.version,
                }),
              )
            }
            data-testid="action-complete-button"
          >
            {pending === "complete" ? "Completing…" : "Complete"}
          </Button>
        ) : null}
        {permissions.can_cancel &&
        (detail.status === "open" || detail.status === "in_progress") ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() =>
              run("cancel", () =>
                transitionActionStatus({
                  actionId: detail.id,
                  toStatus: "cancelled",
                  expectedVersion: detail.version,
                }),
              )
            }
            data-testid="action-cancel-button"
          >
            {pending === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        ) : null}
        {permissions.can_reopen &&
        (detail.status === "completed" || detail.status === "cancelled") ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() =>
              run("reopen", () =>
                reopenAction({
                  actionId: detail.id,
                  expectedVersion: detail.version,
                }),
              )
            }
            data-testid="action-reopen-button"
          >
            {pending === "reopen" ? "Reopening…" : "Reopen"}
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {permissions.can_update && editable ? (
                <form
                  className="flex flex-col gap-4"
                  data-testid="action-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run("save", async () => {
                      const result = await updateActionFields({
                        actionId: detail.id,
                        title,
                        description,
                        priority,
                        dueAt: dateInputToDueAt(dueDate),
                        expectedVersion: detail.version,
                      });
                      if (!result.error) {
                        setMessage("Changes saved.");
                      }
                      return result;
                    });
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="action-title">Title</Label>
                    <Input
                      id="action-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      data-testid="action-title-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="action-description">Description</Label>
                    <Textarea
                      id="action-description"
                      rows={4}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      data-testid="action-description-input"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="action-priority">Priority</Label>
                      <select
                        id="action-priority"
                        className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                        data-testid="action-priority-input"
                      >
                        {ACTION_PRIORITIES.map((option) => (
                          <option key={option} value={option}>
                            {actionPriorityLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="action-due">Due date</Label>
                      <Input
                        id="action-due"
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        data-testid="action-due-input"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={pending !== null}>
                    {pending === "save" ? "Saving…" : "Save changes"}
                  </Button>
                </form>
              ) : (
                <div
                  className="flex flex-col gap-3 text-sm"
                  data-testid="action-readonly-details"
                >
                  {detail.description ? (
                    <p className="leading-relaxed text-muted-foreground">
                      {detail.description}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No description.</p>
                  )}
                  <p className="text-muted-foreground">
                    Created by {detail.created_by_display_name}
                    {detail.completed_at
                      ? ` · Completed ${new Date(detail.completed_at).toLocaleString("en-GB")}`
                      : ""}
                  </p>
                </div>
              )}

              {permissions.can_assign && editable ? (
                <form
                  className="flex flex-col gap-3 border-t border-border pt-4"
                  data-testid="action-assign-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run("assign", async () => {
                      const result = await setActionAssignee({
                        actionId: detail.id,
                        membershipId: assigneeId || null,
                      });
                      if (!result.error) {
                        setMessage(
                          assigneeId
                            ? "Assignee updated."
                            : "Assignee cleared.",
                        );
                      }
                      return result;
                    });
                  }}
                >
                  <Label htmlFor="action-assignee">Assignee</Label>
                  <select
                    id="action-assignee"
                    className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    data-testid="action-assignee-input"
                  >
                    <option value="">Unassigned</option>
                    {assignablePeople.map((person) => (
                      <option
                        key={person.membership_id}
                        value={person.membership_id}
                      >
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={pending !== null}
                  >
                    {pending === "assign" ? "Saving…" : "Save assignee"}
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussion">
          <ResourceComments resourceId={detail.id} comments={comments} />
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionEvidenceBlock
                actionId={detail.id}
                evidence={evidence}
                canEdit={canUploadEvidence && editable}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card data-testid="action-history">
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {detail.status_history.length === 0 ? (
                <p className="text-muted-foreground">No status history yet.</p>
              ) : (
                detail.status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                    data-testid="action-history-entry"
                  >
                    <span>
                      {actionStatusLabel(entry.from_status)} →{" "}
                      {actionStatusLabel(entry.to_status)}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {entry.actor_display_name}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground sm:text-right">
                      {new Date(entry.created_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="action-workspace-error"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-testid="action-workspace-message"
        >
          {message}
        </p>
      ) : null}

      <Link
        href="/platform/actions"
        className="text-sm text-muted-foreground hover:underline"
      >
        Back to actions
      </Link>
    </div>
  );
}
