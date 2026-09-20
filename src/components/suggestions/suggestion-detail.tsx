"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createProjectFromSuggestion,
  createSuggestionAction,
  markSuggestionImplemented,
} from "@/app/(platform)/platform/suggestions/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import {
  ResourceComments,
  type CommentRow,
} from "@/components/comments/resource-comments";
import { SuggestionEvidenceBlock } from "@/components/suggestions/suggestion-evidence-block";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  classificationSummary,
  classificationBadgeVariant,
} from "@/lib/benefits/classification";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
} from "@/lib/benefits/forecast";
import {
  benefitStatusBadgeVariant,
  benefitStatusLabel,
} from "@/lib/benefits/status";
import type { LinkedBenefitSummary } from "@/lib/benefits/types";
import { actionStatusLabel, formatActionReference } from "@/lib/actions/status";
import type { LinkedSuggestionAction } from "@/lib/actions/types";
import {
  formatProjectReference,
  projectStatusLabel,
} from "@/lib/projects/status";
import type { LinkedSuggestionProject } from "@/lib/projects/types";
import { navigateTo } from "@/lib/navigation/navigate";
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
  benefits: LinkedBenefitSummary[];
  canManage: boolean;
  canCreateProject: boolean;
  canUploadEvidence: boolean;
};

export function SuggestionDetail({
  detail,
  comments,
  statusHistory,
  evidence,
  benefits,
  canManage,
  canCreateProject,
  canUploadEvidence,
}: SuggestionDetailProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [createdAction, setCreatedAction] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [implementationSummary, setImplementationSummary] = useState(
    "Improvement completed on the floor.",
  );
  const [employeeOutcome, setEmployeeOutcome] = useState("");
  const status = detail.status as string;
  const id = detail.id as string;
  const linkedActions = Array.isArray(detail.linked_actions)
    ? (detail.linked_actions as LinkedSuggestionAction[])
    : [];
  const linkedProjects = Array.isArray(detail.linked_projects)
    ? (detail.linked_projects as LinkedSuggestionProject[])
    : [];

  async function handleAction() {
    const title = `Action: ${detail.title as string}`;
    const result = await createSuggestionAction(id, title);
    if (result.error) {
      setMessage(result.error);
      setCreatedAction(null);
      return;
    }
    setCreatedAction(result.id ? { id: result.id, title } : null);
    const alreadyLinked = linkedActions.some(
      (action) => action.id === result.id,
    );
    setMessage(
      alreadyLinked
        ? "This suggestion already has a linked action."
        : "Action created",
    );
    router.refresh();
  }

  async function handleProject() {
    const result = await createProjectFromSuggestion(id);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Project created");
    if (result.id) {
      navigateTo(`/platform/projects/${result.id}`);
    }
  }

  async function handleImplemented() {
    if (!employeeOutcome.trim()) {
      setMessage("Employee-facing outcome is required.");
      return;
    }

    const result = await markSuggestionImplemented(
      id,
      implementationSummary.trim(),
      employeeOutcome.trim(),
    );
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
            <Badge variant="outline">
              {detail.category_name_snapshot as string}
            </Badge>
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
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
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
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {detail.problem_or_opportunity as string}
                </p>
              </div>
              <div>
                <p className="font-medium">Proposed change</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {detail.proposed_idea as string}
                </p>
              </div>
              {detail.expected_benefit_summary ? (
                <div>
                  <p className="font-medium">Expected benefit</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
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

        <TabsContent value="benefits">
          <Card data-testid="suggestion-benefits-panel">
            <CardHeader>
              <CardTitle>Linked benefits</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {benefits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No formal benefits linked yet.
                  {detail.expected_benefit_summary ? (
                    <span className="mt-2 block text-muted-foreground">
                      Expected benefit (narrative):{" "}
                      {detail.expected_benefit_summary as string}
                    </span>
                  ) : null}
                </p>
              ) : (
                benefits.map((benefit) => (
                  <AppLink
                    key={benefit.id}
                    href={`/platform/benefits/${benefit.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {benefit.benefit_number
                          ? `${benefit.benefit_number} · `
                          : ""}
                        {benefit.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {classificationSummary(
                          benefit.benefit_class,
                          benefit.financial_type,
                          benefit.non_financial_type,
                        )}
                        · {benefit.relationship_role}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={classificationBadgeVariant(
                          benefit.benefit_class,
                        )}
                      >
                        {benefit.benefit_class}
                      </Badge>
                      <Badge
                        variant={benefitStatusBadgeVariant(benefit.status)}
                      >
                        {benefitStatusLabel(benefit.status)}
                      </Badge>
                      {benefit.benefit_class === "financial" ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Forecast{" "}
                          {formatBenefitCurrencyAmount(
                            benefit.forecast_total_amount,
                            null,
                          )}
                          · Validated{" "}
                          {formatBenefitCurrencyAmount(
                            benefit.validated_realised_total,
                            null,
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Target{" "}
                          {formatMeasureValue(
                            benefit.forecast_total_amount,
                            null,
                          )}
                        </span>
                      )}
                    </div>
                  </AppLink>
                ))
              )}
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
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {detail.implementation_summary as string}
                  </p>
                </div>
              ) : null}
              {detail.employee_outcome ? (
                <div>
                  <p className="font-medium">Outcome shared with proposer</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {detail.employee_outcome as string}
                  </p>
                </div>
              ) : null}
              {canManage && ["accepted", "implementing"].includes(status) ? (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1">
                    <Label htmlFor="implementation-summary">
                      Internal implementation summary
                    </Label>
                    <Textarea
                      id="implementation-summary"
                      rows={2}
                      value={implementationSummary}
                      onChange={(event) =>
                        setImplementationSummary(event.target.value)
                      }
                      data-testid="implementation-summary"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <Label htmlFor="employee-outcome">
                      Outcome for employee
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      This message will be shared with the person who submitted
                      the suggestion and may be included in their completion
                      email.
                    </p>
                    <Textarea
                      id="employee-outcome"
                      required
                      rows={3}
                      value={employeeOutcome}
                      onChange={(event) =>
                        setEmployeeOutcome(event.target.value)
                      }
                      data-testid="employee-outcome"
                    />
                  </label>
                  {linkedProjects.length > 0 ? (
                    <div
                      className="flex flex-col gap-2"
                      data-testid="suggestion-linked-projects"
                    >
                      <p className="font-medium">Linked projects</p>
                      {linkedProjects.map((project) => (
                        <SuggestionLinkedProjectRow
                          key={project.id}
                          project={project}
                        />
                      ))}
                    </div>
                  ) : null}
                  {linkedActions.length > 0 ? (
                    <div
                      className="flex flex-col gap-2"
                      data-testid="suggestion-linked-actions"
                    >
                      <p className="font-medium">Linked actions</p>
                      {linkedActions.map((action) => (
                        <SuggestionLinkedActionRow
                          key={action.id}
                          action={action}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction()}
                      data-testid="suggestion-create-action"
                    >
                      Create action
                    </Button>
                    {canCreateProject ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProject()}
                        data-testid="suggestion-create-project"
                      >
                        Create project
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={() => handleImplemented()}
                      disabled={!employeeOutcome.trim()}
                      data-testid="mark-implemented-button"
                    >
                      Mark implemented
                    </Button>
                  </div>
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

        <TabsContent value="activity" forceMount>
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div
                className="flex flex-col gap-2"
                data-testid="suggestion-activity-projects"
              >
                <p className="font-medium">Linked projects</p>
                {linkedProjects.length === 0 ? (
                  <p className="text-muted-foreground">
                    No linked projects yet.
                  </p>
                ) : (
                  linkedProjects.map((project) => (
                    <SuggestionLinkedProjectRow
                      key={project.id}
                      project={project}
                    />
                  ))
                )}
              </div>
              <div
                className="flex flex-col gap-2"
                data-testid="suggestion-activity-actions"
              >
                <p className="font-medium">Linked actions</p>
                {linkedActions.length === 0 ? (
                  <p className="text-muted-foreground">
                    No linked actions yet.
                  </p>
                ) : (
                  linkedActions.map((action) => (
                    <SuggestionLinkedActionRow
                      key={action.id}
                      action={action}
                    />
                  ))
                )}
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-medium">Status history</p>
                {statusHistory.length === 0 ? (
                  <p className="text-muted-foreground">
                    No status history yet.
                  </p>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {message ? (
        <p
          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-testid="suggestion-handoff-message"
        >
          {message}
          {createdAction ? (
            <>
              {" "}
              <AppLink
                href={`/platform/actions/${createdAction.id}`}
                className="text-primary hover:underline"
                data-testid="suggestion-open-created-action"
              >
                Open action
              </AppLink>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function SuggestionLinkedProjectRow({
  project,
}: {
  project: LinkedSuggestionProject;
}) {
  const reference = formatProjectReference(
    project.project_number,
    project.title,
  );

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`suggestion-linked-project-${project.id}`}
    >
      <div>
        <p className="font-medium">{project.title}</p>
        <p className="text-xs text-muted-foreground">
          {reference} · {projectStatusLabel(project.status)}
        </p>
      </div>
      {project.can_open ? (
        <AppLink
          href={project.href}
          className="text-sm text-primary hover:underline"
          data-testid={`suggestion-open-project-${project.id}`}
          aria-label={`Open project ${reference}`}
        >
          Open project
        </AppLink>
      ) : (
        <span className="text-xs text-muted-foreground">
          Linked project is outside your current scope.
        </span>
      )}
    </div>
  );
}

function SuggestionLinkedActionRow({
  action,
}: {
  action: LinkedSuggestionAction;
}) {
  const label = `${formatActionReference(action.action_number, action.title)} · ${action.title}`;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`suggestion-linked-action-${action.id}`}
    >
      <div>
        <p className="font-medium">{action.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatActionReference(action.action_number, action.title)} ·{" "}
          {actionStatusLabel(action.status)}
        </p>
      </div>
      {action.can_open ? (
        <AppLink
          href={action.href}
          className="text-sm text-primary hover:underline"
          data-testid={`suggestion-open-action-${action.id}`}
          aria-label={`Open action ${label}`}
        >
          Open action
        </AppLink>
      ) : (
        <span className="text-xs text-muted-foreground">
          Linked action is outside your current scope.
        </span>
      )}
    </div>
  );
}
