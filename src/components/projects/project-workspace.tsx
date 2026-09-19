"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  approveProject,
  assignProjectTeamMember,
  completeProjectPhase,
  createProjectAction,
  createProjectMetric,
  recordMetricMeasurement,
  returnProjectToDraft,
  startProject,
  submitProject,
  updateProjectDraft,
} from "@/app/(platform)/platform/projects/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import {
  ResourceComments,
  type CommentRow,
} from "@/components/comments/resource-comments";
import { PersonSelect } from "@/components/people/person-select";
import { ProjectBenefitCreateForm } from "@/components/projects/project-benefit-create-form";
import { ProjectEvidenceBlock } from "@/components/projects/project-evidence-block";
import { ProjectHeader } from "@/components/projects/project-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  actionPriorityLabel,
  actionStatusBadgeVariant,
  actionStatusLabel,
  formatActionReference,
} from "@/lib/actions/status";
import {
  hasExactlyOneActiveOwner,
  isCharterReady,
  missingCharterRequirements,
} from "@/lib/projects/charter";
import {
  formatProjectReference,
  phaseStatusLabel,
  projectStatusBadgeVariant,
  projectStatusLabel,
  teamRoleLabel,
} from "@/lib/projects/status";
import type { ProjectDetail, ProjectTeamMember } from "@/lib/projects/types";
import type { PersonSelectOption } from "@/modules/organisation/site-context";

type ProjectActionRow = {
  id: string;
  action_number: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  due_at: string | null;
  project_phase_id: string | null;
};

type EnrichedTeamMember = ProjectTeamMember & {
  display_name: string;
};

type MethodologyOption = {
  versionId: string;
  label: string;
};

type ProjectWorkspaceProps = {
  detail: ProjectDetail;
  actions: ProjectActionRow[];
  evidence: EvidenceItem[];
  comments: CommentRow[];
  teamMembers: EnrichedTeamMember[];
  benefits: LinkedBenefitSummary[];
  unitName?: string | null;
  methodologyLabel?: string | null;
  currentPhaseTitle?: string | null;
  ownerName?: string | null;
  canManage: boolean;
  canCreateBenefit: boolean;
  canUploadEvidence: boolean;
  people: PersonSelectOption[];
  methodologies: MethodologyOption[];
  requiresSiteSelection?: boolean;
};

const TEAM_ROLES = ["owner", "sponsor", "facilitator", "member"] as const;

export function ProjectWorkspace({
  detail,
  actions,
  evidence,
  comments,
  teamMembers,
  benefits,
  unitName,
  methodologyLabel,
  currentPhaseTitle,
  ownerName,
  canManage,
  canCreateBenefit,
  canUploadEvidence,
  people,
  methodologies,
  requiresSiteSelection = false,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(detail.title);
  const [problem, setProblem] = useState(detail.problem_statement ?? "");
  const [objective, setObjective] = useState(detail.objective ?? "");
  const [impact, setImpact] = useState(detail.expected_impact_summary ?? "");
  const [scopeIn, setScopeIn] = useState(detail.scope_in ?? "");
  const [scopeOut, setScopeOut] = useState(detail.scope_out ?? "");
  const [baseline, setBaseline] = useState(detail.baseline_summary ?? "");
  const [target, setTarget] = useState(detail.target_summary ?? "");
  const [risks, setRisks] = useState(detail.constraints_risks ?? "");
  const [sustainment, setSustainment] = useState(
    detail.sustainment_expectation ?? "",
  );
  const [methodologyVersionId, setMethodologyVersionId] = useState(
    detail.methodology_version_id ?? "",
  );
  const [priority, setPriority] = useState(detail.priority);
  const [plannedStart, setPlannedStart] = useState(
    detail.planned_start_date ?? "",
  );
  const [plannedEnd, setPlannedEnd] = useState(detail.planned_end_date ?? "");
  const [teamMembershipId, setTeamMembershipId] = useState("");
  const [teamRole, setTeamRole] =
    useState<(typeof TEAM_ROLES)[number]>("owner");
  const [metricName, setMetricName] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const [metricBaseline, setMetricBaseline] = useState("");
  const [metricTarget, setMetricTarget] = useState("");

  const canEditDraft = canManage && detail.status === "draft";
  const canEditTeam =
    canManage && ["draft", "submitted", "approved"].includes(detail.status);
  const canAddMetrics = canEditTeam;
  const canCreateActions =
    canManage &&
    ["draft", "submitted", "approved", "active", "on_hold"].includes(
      detail.status,
    );
  const canEditEvidence =
    canUploadEvidence &&
    canManage &&
    ["draft", "submitted", "approved", "active", "on_hold"].includes(
      detail.status,
    );

  const charterInput = useMemo(
    () => ({
      title: canEditDraft ? title : detail.title,
      problemStatement: canEditDraft ? problem : detail.problem_statement,
      objective: canEditDraft ? objective : detail.objective,
      methodologyVersionId: canEditDraft
        ? methodologyVersionId
        : detail.methodology_version_id,
      hasActiveOwner: hasExactlyOneActiveOwner(teamMembers),
    }),
    [
      canEditDraft,
      detail.methodology_version_id,
      detail.objective,
      detail.problem_statement,
      detail.title,
      methodologyVersionId,
      objective,
      problem,
      teamMembers,
      title,
    ],
  );
  const missingRequirements = missingCharterRequirements(charterInput);
  const charterReady = isCharterReady(charterInput);

  async function handleSaveCharter() {
    const result = await updateProjectDraft({
      projectId: detail.id,
      title: title.trim(),
      problemStatement: problem,
      objective,
      expectedImpactSummary: impact,
      scopeIn,
      scopeOut,
      baselineSummary: baseline,
      targetSummary: target,
      constraintsRisks: risks,
      sustainmentExpectation: sustainment,
      ...(methodologyVersionId ? { methodologyVersionId } : {}),
      ...(plannedStart ? { plannedStartDate: plannedStart } : {}),
      ...(plannedEnd ? { plannedEndDate: plannedEnd } : {}),
      priority,
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Charter saved");
    router.refresh();
  }

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitProject(detail.id);
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Project submitted for approval");
    router.refresh();
  }

  async function handleApprove() {
    const result = await approveProject(detail.id);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Project approved");
    router.refresh();
  }

  async function handleReturnToDraft() {
    const result = await returnProjectToDraft(detail.id);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Project returned to draft");
    router.refresh();
  }

  async function handleStart() {
    const result = await startProject(detail.id);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Project started");
    router.refresh();
  }

  async function handleCompletePhase(phaseId: string) {
    const result = await completeProjectPhase(detail.id, phaseId);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Phase completed");
    router.refresh();
  }

  async function handleCreateAction() {
    if (!actionTitle.trim()) return;
    const result = await createProjectAction({
      projectId: detail.id,
      title: actionTitle.trim(),
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setActionTitle("");
    setMessage("Action created");
    router.refresh();
  }

  async function handleAssignTeam() {
    if (!teamMembershipId) return;
    const result = await assignProjectTeamMember({
      projectId: detail.id,
      membershipId: teamMembershipId,
      teamRole,
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Team member assigned");
    router.refresh();
  }

  async function handleAddMetric() {
    if (!metricName.trim()) return;
    const result = await createProjectMetric({
      projectId: detail.id,
      key: `metric-${Date.now()}`,
      name: metricName.trim(),
      ...(metricUnit.trim() ? { unitLabel: metricUnit.trim() } : {}),
      ...(metricBaseline.trim() ? { baseline: Number(metricBaseline) } : {}),
      ...(metricTarget.trim() ? { target: Number(metricTarget) } : {}),
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMetricName("");
    setMetricUnit("");
    setMetricBaseline("");
    setMetricTarget("");
    setMessage("Measure added");
    router.refresh();
  }

  async function handleRecordMeasurement(metricId: string) {
    const raw = metricValues[metricId];
    if (!raw) return;
    const result = await recordMetricMeasurement({
      metricId,
      measuredValue: Number(raw),
      projectId: detail.id,
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMetricValues((prev) => ({ ...prev, [metricId]: "" }));
    setMessage("Measurement recorded");
    router.refresh();
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
        onReturnToDraft={handleReturnToDraft}
        onStart={handleStart}
        charterReady={charterReady}
        missingRequirements={missingRequirements}
        submitting={submitting}
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
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
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
              {canEditDraft ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="project-title">Title</Label>
                    <Input
                      id="project-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      data-testid="project-title-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="project-problem">Problem statement</Label>
                    <Textarea
                      id="project-problem"
                      value={problem}
                      onChange={(event) => setProblem(event.target.value)}
                      data-testid="project-problem-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="project-objective">Objective</Label>
                    <Textarea
                      id="project-objective"
                      value={objective}
                      onChange={(event) => setObjective(event.target.value)}
                      data-testid="project-objective-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="project-impact">Expected impact</Label>
                    <Textarea
                      id="project-impact"
                      value={impact}
                      onChange={(event) => setImpact(event.target.value)}
                      data-testid="project-impact-input"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-scope-in">Scope in</Label>
                      <Textarea
                        id="project-scope-in"
                        value={scopeIn}
                        onChange={(event) => setScopeIn(event.target.value)}
                        data-testid="project-scope-in-input"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-scope-out">Scope out</Label>
                      <Textarea
                        id="project-scope-out"
                        value={scopeOut}
                        onChange={(event) => setScopeOut(event.target.value)}
                        data-testid="project-scope-out-input"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-baseline">Baseline</Label>
                      <Textarea
                        id="project-baseline"
                        value={baseline}
                        onChange={(event) => setBaseline(event.target.value)}
                        data-testid="project-baseline-input"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-target">Target</Label>
                      <Textarea
                        id="project-target"
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                        data-testid="project-target-input"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="project-risks">Constraints & risks</Label>
                    <Textarea
                      id="project-risks"
                      value={risks}
                      onChange={(event) => setRisks(event.target.value)}
                      data-testid="project-risks-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="project-sustainment">
                      Sustainment expectation
                    </Label>
                    <Textarea
                      id="project-sustainment"
                      value={sustainment}
                      onChange={(event) => setSustainment(event.target.value)}
                      data-testid="project-sustainment-input"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-methodology">Methodology</Label>
                      <select
                        id="project-methodology"
                        className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                        value={methodologyVersionId}
                        onChange={(event) =>
                          setMethodologyVersionId(event.target.value)
                        }
                        data-testid="project-methodology-input"
                      >
                        <option value="">Select methodology…</option>
                        {methodologies.map((option) => (
                          <option
                            key={option.versionId}
                            value={option.versionId}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-priority">Priority</Label>
                      <select
                        id="project-priority"
                        className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-planned-start">
                        Planned start
                      </Label>
                      <Input
                        id="project-planned-start"
                        type="date"
                        value={plannedStart}
                        onChange={(event) =>
                          setPlannedStart(event.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="project-planned-end">Planned end</Label>
                      <Input
                        id="project-planned-end"
                        type="date"
                        value={plannedEnd}
                        onChange={(event) => setPlannedEnd(event.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleSaveCharter()}
                    data-testid="save-charter-button"
                  >
                    Save charter
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-medium">Problem statement</p>
                    <p className="text-muted-foreground">
                      {detail.problem_statement ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Objective</p>
                    <p className="text-muted-foreground">
                      {detail.objective ?? "—"}
                    </p>
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
                      <p className="text-muted-foreground">
                        {detail.scope_in ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Scope out</p>
                      <p className="text-muted-foreground">
                        {detail.scope_out ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="font-medium">Baseline</p>
                      <p className="text-muted-foreground">
                        {detail.baseline_summary ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Target</p>
                      <p className="text-muted-foreground">
                        {detail.target_summary ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Constraints & risks</p>
                    <p className="text-muted-foreground">
                      {detail.constraints_risks ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Sustainment expectation</p>
                    <p className="text-muted-foreground">
                      {detail.sustainment_expectation ?? "—"}
                    </p>
                  </div>
                </>
              )}
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCompletePhase(phase.id)}
                        >
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
              {canCreateActions ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={actionTitle}
                    onChange={(event) => setActionTitle(event.target.value)}
                    placeholder="New action title"
                    data-testid="project-action-title"
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleCreateAction()}
                    data-testid="project-add-action"
                  >
                    Add action
                  </Button>
                </div>
              ) : null}
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No linked actions yet.
                </p>
              ) : (
                actions.map((action) => (
                  <Link
                    key={action.id}
                    href={`/platform/actions/${action.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/40"
                    data-testid={`project-action-${action.id}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatActionReference(
                          action.action_number,
                          action.title,
                        )}
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 gap-2">
                      <Badge variant={actionStatusBadgeVariant(action.status)}>
                        {actionStatusLabel(action.status)}
                      </Badge>
                      <Badge variant="secondary">
                        {actionPriorityLabel(action.priority)}
                      </Badge>
                    </div>
                  </Link>
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
              {canAddMetrics ? (
                <div
                  className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
                  data-testid="project-add-measure"
                >
                  <Input
                    value={metricName}
                    onChange={(event) => setMetricName(event.target.value)}
                    placeholder="Display name"
                    data-testid="project-measure-name"
                  />
                  <Input
                    value={metricUnit}
                    onChange={(event) => setMetricUnit(event.target.value)}
                    placeholder="Unit"
                  />
                  <Input
                    type="number"
                    value={metricBaseline}
                    onChange={(event) => setMetricBaseline(event.target.value)}
                    placeholder="Baseline"
                  />
                  <Input
                    type="number"
                    value={metricTarget}
                    onChange={(event) => setMetricTarget(event.target.value)}
                    placeholder="Target"
                  />
                  <Button
                    size="sm"
                    className="sm:col-span-2"
                    onClick={() => void handleAddMetric()}
                    data-testid="project-add-measure-button"
                  >
                    Add measure
                  </Button>
                </div>
              ) : null}
              {detail.metrics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No measures defined.
                </p>
              ) : (
                detail.metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="rounded-lg border border-border p-3"
                  >
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
                    {canManage &&
                    ["active", "on_hold", "completed"].includes(
                      detail.status,
                    ) ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          type="number"
                          value={metricValues[metric.id] ?? ""}
                          onChange={(event) =>
                            setMetricValues((prev) => ({
                              ...prev,
                              [metric.id]: event.target.value,
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
            <CardContent className="flex flex-col gap-3">
              <ProjectBenefitCreateForm
                projectId={detail.id}
                defaultTitle={`${formatProjectReference(detail.project_number, detail.title)} benefit`}
                canCreate={canCreateBenefit}
              />
              {benefits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No benefits linked to this project.
                </p>
              ) : (
                benefits.map((benefit) => (
                  <Link
                    key={benefit.id}
                    href={`/platform/benefits/${benefit.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={`project-linked-benefit-${benefit.id}`}
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
            <CardContent className="flex flex-col gap-3">
              {canEditTeam ? (
                <div
                  className="flex flex-col gap-3 rounded-lg border border-border p-3"
                  data-testid="project-assign-team"
                >
                  <PersonSelect
                    label="Person"
                    options={people}
                    value={teamMembershipId}
                    onChange={setTeamMembershipId}
                    allowEmpty
                    requiresSiteSelection={requiresSiteSelection}
                    testId="project-team-person"
                  />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="project-team-role">Role</Label>
                    <select
                      id="project-team-role"
                      className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                      value={teamRole}
                      onChange={(event) =>
                        setTeamRole(
                          event.target.value as (typeof TEAM_ROLES)[number],
                        )
                      }
                      data-testid="project-team-role"
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {teamRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleAssignTeam()}
                    disabled={!teamMembershipId}
                    data-testid="project-assign-team-button"
                  >
                    Assign
                  </Button>
                </div>
              ) : null}
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No team assignments yet.
                </p>
              ) : (
                teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">{member.display_name}</span>
                    <Badge variant="outline">
                      {teamRoleLabel(member.team_role)}
                      {member.valid_to ? " · ended" : ""}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <ProjectEvidenceBlock
            projectId={detail.id}
            evidence={evidence}
            canEdit={canEditEvidence}
          />
        </TabsContent>

        <TabsContent value="discussion">
          <ResourceComments resourceId={detail.id} comments={comments} />
        </TabsContent>

        <TabsContent value="activity">
          <Card data-testid="project-activity">
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {detail.status_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No status changes recorded.
                </p>
              ) : (
                detail.status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                    data-testid="project-history-entry"
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
