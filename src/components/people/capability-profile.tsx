"use client";

import { useState } from "react";

import { CapabilityActionDialog } from "@/components/people/capability-action-dialog";
import { SkillAssessmentDialog } from "@/components/people/skill-assessment-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type GapRow = {
  skill_id: string;
  skill_name: string;
  gap: {
    status?: string;
    current_order?: number;
    target_order?: number;
    scale_version_id?: string;
    target_scale_version_id?: string;
  };
};

type RequirementRow = {
  course_id?: string;
  course_name: string;
  mandatory: boolean;
  is_satisfied: boolean;
};

type CompletionRow = {
  completed_at: string;
  validity_state: string;
  status: string;
  course_version_number?: number;
};

type AssessmentRow = {
  assessment_id: string;
  skill_id: string;
  assertion_type: string;
  is_authoritative: boolean;
  assessed_at: string;
  assessment_method?: string;
  valid_until?: string | null;
};

type ProficiencyLevel = {
  id: string;
  order_value: number;
  label: string;
  scale_version_id: string;
};

type ImprovementContribution = {
  suggestions_authored?: number;
  suggestions_implemented_involvement?: number;
  recognition_received?: number;
};

type CapabilityProfileProps = {
  membershipId: string;
  displayName: string;
  trainingProfile: Record<string, unknown> | null;
  skillsProfile: Record<string, unknown> | null;
  proficiencyLevels: ProficiencyLevel[];
  improvementContribution?: ImprovementContribution | null;
  canValidateSkills: boolean;
  canSelfAssess: boolean;
  canCreateActions: boolean;
};

function trainingStatusLabel(req: RequirementRow) {
  if (req.is_satisfied) return "Completed";
  return req.mandatory ? "Required" : "Optional";
}

export function CapabilityProfile({
  membershipId,
  displayName,
  trainingProfile,
  skillsProfile,
  proficiencyLevels,
  improvementContribution,
  canValidateSkills,
  canSelfAssess,
  canCreateActions,
}: CapabilityProfileProps) {
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentMode, setAssessmentMode] = useState<"validation" | "self">(
    "validation",
  );
  const [actionOpen, setActionOpen] = useState(false);
  const [actionContext, setActionContext] = useState<{
    gapType: "training_gap" | "skill_gap";
    courseId?: string;
    skillId?: string;
    title: string;
  } | null>(null);

  const requirements =
    (trainingProfile?.requirements as RequirementRow[] | undefined) ?? [];
  const completions =
    (trainingProfile?.completions as CompletionRow[] | undefined) ?? [];
  const gaps = (skillsProfile?.gaps as GapRow[] | undefined) ?? [];
  const assessments =
    (skillsProfile?.assessments as AssessmentRow[] | undefined) ?? [];
  const skillGaps = gaps.filter((g) => g.gap?.status === "below_requirement");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {canValidateSkills ? (
          <Button
            size="sm"
            onClick={() => {
              setAssessmentMode("validation");
              setAssessmentOpen(true);
            }}
            data-testid="open-skill-assessment"
          >
            Record skill assessment
          </Button>
        ) : null}
        {canSelfAssess ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAssessmentMode("self");
              setAssessmentOpen(true);
            }}
            data-testid="open-self-assessment"
          >
            Self assessment
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Training</h2>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Required
              </h3>
              {requirements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No requirements configured.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {requirements.map((req, index) => (
                    <li
                      key={`${req.course_name}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>{req.course_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={req.is_satisfied ? "default" : "outline"}
                        >
                          {trainingStatusLabel(req)}
                        </Badge>
                        {canCreateActions &&
                        req.mandatory &&
                        !req.is_satisfied &&
                        req.course_id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActionContext({
                                gapType: "training_gap",
                                courseId: req.course_id!,
                                title: `Close training gap: ${req.course_name}`,
                              });
                              setActionOpen(true);
                            }}
                            data-testid={`training-gap-action-${req.course_id}`}
                          >
                            Action
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                History
              </h3>
              {completions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No completions recorded.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {completions.map((item, index) => (
                    <li key={index} className="text-sm">
                      {new Date(item.completed_at).toLocaleDateString("en-GB")}
                      {item.course_version_number != null
                        ? ` · v${item.course_version_number}`
                        : ""}
                      {" — "}
                      {item.validity_state}
                      {item.status !== "completed" ? ` (${item.status})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Skills</h2>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Capability gaps
              </h3>
              {skillGaps.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No skill gaps identified.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {skillGaps.map((item) => (
                    <li
                      key={item.skill_id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {item.skill_name}: {item.gap.current_order ?? 0} /{" "}
                        {item.gap.target_order}
                      </span>
                      {canCreateActions ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActionContext({
                              gapType: "skill_gap",
                              skillId: item.skill_id,
                              title: `Close skill gap: ${item.skill_name}`,
                            });
                            setActionOpen(true);
                          }}
                          data-testid={`skill-gap-action-${item.skill_id}`}
                        >
                          Action
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Assessment history
              </h3>
              {assessments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No assessments recorded.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {assessments.map((item) => (
                    <li key={item.assessment_id} className="text-sm">
                      {new Date(item.assessed_at).toLocaleDateString("en-GB")}
                      {" — "}
                      {item.assertion_type}
                      {item.is_authoritative ? " (validated)" : ""}
                      {item.assessment_method
                        ? ` · ${item.assessment_method}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

      {improvementContribution ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Improvement & recognition</h2>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Suggestions authored</p>
              <p className="text-2xl font-semibold tabular-nums">
                {improvementContribution.suggestions_authored ?? 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">
                Implementation involvement
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {improvementContribution.suggestions_implemented_involvement ??
                  0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Recognition received</p>
              <p className="text-2xl font-semibold tabular-nums">
                {improvementContribution.recognition_received ?? 0}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {(canValidateSkills || canSelfAssess) && assessmentOpen ? (
        <SkillAssessmentDialog
          open={assessmentOpen}
          onOpenChange={setAssessmentOpen}
          membershipId={membershipId}
          displayName={displayName}
          gaps={gaps}
          levels={proficiencyLevels}
          mode={assessmentMode}
        />
      ) : null}

      {canCreateActions && actionContext ? (
        <CapabilityActionDialog
          open={actionOpen}
          onOpenChange={setActionOpen}
          membershipId={membershipId}
          displayName={displayName}
          gapType={actionContext.gapType}
          {...(actionContext.courseId
            ? { courseId: actionContext.courseId }
            : {})}
          {...(actionContext.skillId ? { skillId: actionContext.skillId } : {})}
          defaultTitle={actionContext.title}
        />
      ) : null}
    </div>
  );
}
