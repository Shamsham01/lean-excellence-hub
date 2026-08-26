"use client";

import { useState } from "react";

import {
  createProjectFromSuggestion,
  createSuggestionAction,
  markSuggestionImplemented,
} from "@/app/(platform)/platform/suggestions/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { ResourceComments, type CommentRow } from "@/components/comments/resource-comments";
import { SuggestionEvidenceBlock } from "@/components/suggestions/suggestion-evidence-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { suggestionStatusLabel } from "@/lib/suggestions/status";

type StatusHistoryRow = {
  from_status: string;
  to_status: string;
  changed_at: string;
  reason: string | null;
};

type SuggestionDetailProps = {
  detail: Record<string, unknown>;
  comments: CommentRow[];
  statusHistory: StatusHistoryRow[];
  evidence: EvidenceItem[];
  canManage: boolean;
  canCreateProject: boolean;
  canUploadEvidence: boolean;
};

export function SuggestionDetail({
  detail,
  comments,
  statusHistory,
  evidence,
  canManage,
  canCreateProject,
  canUploadEvidence,
}: SuggestionDetailProps) {
  const [message, setMessage] = useState<string | null>(null);
  const status = detail.status as string;
  const id = detail.id as string;

  async function handleAction() {
    const result = await createSuggestionAction(id, `Action: ${detail.title as string}`);
    setMessage(result.error ? result.error : "Action created");
  }

  async function handleProject() {
    const result = await createProjectFromSuggestion(id);
    setMessage(result.error ? result.error : `Project created: ${result.id ?? ""}`);
  }

  async function handleImplemented() {
    const result = await markSuggestionImplemented(id, "Improvement completed on the floor.");
    setMessage(result.error ? result.error : "Marked implemented");
  }

  return (
    <div className="flex flex-col gap-6" data-testid="suggestion-detail-page">
      <div className="border-b border-border pb-6">
        <p className="text-sm font-medium text-muted-foreground">
          {detail.suggestion_number as string}
        </p>
        <h1 className="typography-page-title mt-1">{detail.title as string}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{suggestionStatusLabel(status)}</Badge>
          {detail.category_name_snapshot ? (
            <Badge variant="outline">{detail.category_name_snapshot as string}</Badge>
          ) : null}
          {detail.origin_unit_name_snapshot ? (
            <span className="text-sm text-muted-foreground">
              {detail.origin_unit_name_snapshot as string}
            </span>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
          <TabsTrigger value="implementation">Implementation</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6 text-sm">
              <div>
                <p className="font-medium">What was noticed</p>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  {detail.problem_or_opportunity as string}
                </p>
              </div>
              <div>
                <p className="font-medium">Proposed change</p>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  {detail.proposed_idea as string}
                </p>
              </div>
              {detail.expected_benefit_summary ? (
                <div>
                  <p className="font-medium">Expected benefit</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {detail.expected_benefit_summary as string}
                  </p>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Programme: {detail.programme_name_snapshot as string}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussion">
          <Card>
            <CardContent className="pt-6">
              <ResourceComments resourceId={id} comments={comments} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementation">
          <Card>
            <CardHeader>
              <CardTitle>Implementation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {detail.implementation_summary ? (
                <div>
                  <p className="font-medium">Summary</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {detail.implementation_summary as string}
                  </p>
                </div>
              ) : null}
              {canManage && ["accepted", "implementing"].includes(status) ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleAction()}>
                    Create action
                  </Button>
                  {canCreateProject ? (
                    <Button size="sm" variant="outline" onClick={() => handleProject()}>
                      Create project
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => handleImplemented()}>
                    Mark implemented
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {status === "implemented"
                    ? "This suggestion has been marked implemented."
                    : "Implementation actions appear once the suggestion is accepted."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <SuggestionEvidenceBlock
                suggestionId={id}
                evidence={evidence}
                canEdit={canUploadEvidence}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {statusHistory.length === 0 ? (
                <p className="text-muted-foreground">No status history yet.</p>
              ) : (
                statusHistory.map((entry, index) => (
                  <div
                    key={`${entry.changed_at}-${index}`}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <span>
                      {suggestionStatusLabel(entry.from_status)} →{" "}
                      {suggestionStatusLabel(entry.to_status)}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground sm:text-right">
                      {new Date(entry.changed_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {message ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
