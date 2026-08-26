"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  approveProject,
  completeProjectPhase,
  createProjectAction,
  recordMetricMeasurement,
  startProject,
  submitProject,
} from "@/app/(platform)/platform/projects/actions";
import { ProjectHeader } from "@/components/projects/project-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  phaseStatusLabel,
  projectStatusBadgeVariant,
  projectStatusLabel,
  teamRoleLabel,
} from "@/lib/projects/status";
import type { ProjectDetail, ProjectTeamMember } from "@/lib/projects/types";

type ProjectActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  project_phase_id: string | null;
};

type ProjectEvidenceRow = {
  id: string;
  attachment_id: string;
  filename: string;
  project_phase_id: string | null;
  created_at: string;
};

type EnrichedTeamMember = ProjectTeamMember & {
  display_name: string;
};

type ProjectWorkspaceProps = {
  detail: ProjectDetail;
  actions: ProjectActionRow[];
  evidence: ProjectEvidenceRow[];
  teamMembers: EnrichedTeamMember[];
  benefits: LinkedBenefitSummary[];
  unitName?: string | null;
  methodologyLabel?: string | null;
  currentPhaseTitle?: string | null;
  ownerName?: string | null;
  canManage: boolean;
};

export function ProjectWorkspace({
  detail,
  actions,
  evidence,
  teamMembers,
  benefits,
  unitName,
  methodologyLabel,
  currentPhaseTitle,
  ownerName,
  canManage,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [actionTitle, setActionTitle] = useState("");
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});

  async function handleSubmit() {
    try {
      await submitProject(detail.id);
      setMessage("Project submitted for approval");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Submit failed");
    }
  }

  async function handleApprove() {
    try {
      await approveProject(detail.id);
      setMessage("Project approved");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function handleStart() {
    try {
      await startProject(detail.id);
      setMessage("Project started");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Start failed");
    }
  }

  async function handleCompletePhase(phaseId: string) {
    try {
      await completeProjectPhase(detail.id, phaseId);
      setMessage("Phase completed");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Phase completion failed");
    }
  }

  async function handleCreateAction() {
    if (!actionTitle.trim()) return;
    try {
      await createProjectAction({
        projectId: detail.id,
        title: actionTitle.trim(),
      });
      setActionTitle("");
      setMessage("Action created");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action creation failed");
    }
  }

  async function handleRecordMeasurement(metricId: string) {
    const raw = metricValues[metricId];
    if (!raw) return;
    try {
      await recordMetricMeasurement({
        metricId,
        measuredValue: Number(raw),
        projectId: detail.id,
      });
      setMetricValues((prev) => ({ ...prev, [metricId]: "" }));
      setMessage("Measurement recorded");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Measurement failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ProjectHeader
        detail={detail}
        canManage={canManage}
        unitName={unitName ?? null}
        methodologyLabel={methodologyLabel ?? null}
        currentPhaseTitle={currentPhaseTitle ?? null}
        ownerName={ownerName ?? null}
        message={message}
        onSubmit={handleSubmit}
        onApprove={handleApprove}
        onStart={handleStart}
      />

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="measures">Measures</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {detail.status === "completed" && detail.completion_snapshot ? (
            <Card className="mb-4 border-primary/20 bg-muted/30">
              <CardHeader>
                <CardTitle>Completion outcome</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {detail.completion_snapshot.outcome_summary ? (
                  <div>
                    <p className="font-medium">Outcome</p>
                    <p className="text-muted-foreground">
                      {String(detail.completion_snapshot.outcome_summary)}
                    </p>
                  </div>
                ) : null}
                {detail.completion_snapshot.lessons_learned ? (
                  <div>
                    <p className="font-medium">Lessons learned</p>
                    <p className="text-muted-foreground">
                      {String(detail.completion_snapshot.lessons_learned)}
                    </p>
                  </div>
                ) : null}
                {detail.completion_snapshot.sustainment_summary ? (
                  <div>
                    <p className="font-medium">Sustainment</p>
                    <p className="text-muted-foreground">
                      {String(detail.completion_snapshot.sustainment_summary)}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Charter</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div>
                <p className="font-medium">Problem statement</p>
                <p className="text-muted-foreground">{detail.problem_statement ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium">Objective</p>
                <p className="text-muted-foreground">{detail.objective ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium">Expected impact</p>
                <p className="text-muted-foreground">
                  {detail.expected_impact_summary ?? "—"}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium">Scope in</p>
                  <p className="text-muted-foreground">{detail.scope_in ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Scope out</p>
                  <p className="text-muted-foreground">{detail.scope_out ?? "—"}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium">Baseline</p>
                  <p className="text-muted-foreground">{detail.baseline_summary ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Target</p>
                  <p className="text-muted-foreground">{detail.target_summary ?? "—"}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">Constraints & risks</p>
                <p className="text-muted-foreground">{detail.constraints_risks ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium">Sustainment expectation</p>
                <p className="text-muted-foreground">
                  {detail.sustainment_expectation ?? "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phases">
          <Card>
            <CardHeader>
              <CardTitle>Methodology phases</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {detail.phases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Phases appear after the project is started with a methodology.
                </p>
              ) : (
                detail.phases.map((phase) => (
                  <div
                    key={phase.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {phase.display_order}. {phase.title_snapshot}
                      </p>
                      {phase.description_snapshot ? (
                        <p className="text-sm text-muted-foreground">
                          {phase.description_snapshot}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={projectStatusBadgeVariant(phase.status)}>
                        {phaseStatusLabel(phase.status)}
                      </Badge>
                      {canManage &&
                      detail.status === "active" &&
                      phase.status === "in_progress" ? (
                        <Button size="sm" variant="outline" onClick={() => handleCompletePhase(phase.id)}>
                          Complete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Project actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {canManage && ["active", "on_hold"].includes(detail.status) ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    placeholder="New action title"
                  />
                  <Button size="sm" onClick={() => handleCreateAction()}>
                    Add action
                  </Button>
                </div>
              ) : null}
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked actions yet.</p>
              ) : (
                actions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{action.title}</span>
                    <Badge variant="outline">{action.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="measures">
          <Card>
            <CardHeader>
              <CardTitle>Success measures</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {detail.metrics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No measures defined.</p>
              ) : (
                detail.metrics.map((metric) => (
                  <div key={metric.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{metric.display_name}</p>
                      {metric.is_locked ? (
                        <Badge variant="secondary">Locked</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Baseline {metric.baseline_value ?? "—"} → Target{" "}
                      {metric.target_value ?? "—"}
                      {metric.unit_label ? ` ${metric.unit_label}` : ""}
                    </p>
                    {canManage && ["active", "on_hold", "completed"].includes(detail.status) ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          type="number"
                          value={metricValues[metric.id] ?? ""}
                          onChange={(e) =>
                            setMetricValues((prev) => ({
                              ...prev,
                              [metric.id]: e.target.value,
                            }))
                          }
                          placeholder="Measured value"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecordMeasurement(metric.id)}
                        >
                          Record
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benefits">
          <Card data-testid="project-benefits-panel">
            <CardHeader>
              <CardTitle>Linked benefits</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {benefits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No benefits linked to this project.</p>
              ) : (
                benefits.map((benefit) => (
                  <Link
                    key={benefit.id}
                    href={`/platform/benefits/${benefit.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {benefit.benefit_number ? `${benefit.benefit_number} · ` : ""}
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
                      <Badge variant={classificationBadgeVariant(benefit.benefit_class)}>
                        {benefit.benefit_class}
                      </Badge>
                      <Badge variant={benefitStatusBadgeVariant(benefit.status)}>
                        {benefitStatusLabel(benefit.status)}
                      </Badge>
                      {benefit.benefit_class === "financial" ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          Forecast{" "}
                          {formatBenefitCurrencyAmount(benefit.forecast_total_amount, null)}
                          · Validated{" "}
                          {formatBenefitCurrencyAmount(benefit.validated_realised_total, null)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Target {formatMeasureValue(benefit.forecast_total_amount, null)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team assignments yet.</p>
              ) : (
                teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">{member.display_name}</span>
                    <Badge variant="outline">{teamRoleLabel(member.team_role)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence linked yet.</p>
              ) : (
                evidence.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">{link.filename}</span>
                    <span className="text-muted-foreground">
                      {new Date(link.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {detail.status_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status changes recorded.</p>
              ) : (
                detail.status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                  >
                    <p>
                      {projectStatusLabel(entry.from_status)} →{" "}
                      {projectStatusLabel(entry.to_status)}
                    </p>
                    <p className="text-xs text-muted-foreground sm:text-right">
                      {new Date(entry.changed_at).toLocaleString("en-GB")}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
