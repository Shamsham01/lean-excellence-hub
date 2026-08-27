"use client";

import { useState } from "react";

import { CaseHeader } from "@/components/problem-solving/case-header";
import { CauseAnalysisPanel } from "@/components/problem-solving/cause-analysis-panel";
import { ContainmentPanel } from "@/components/problem-solving/containment-panel";
import { CountermeasuresPanel } from "@/components/problem-solving/countermeasures-panel";
import { CurrentConditionPanel } from "@/components/problem-solving/current-condition-panel";
import { HistoryPanel } from "@/components/problem-solving/history-panel";
import { OverviewPanel } from "@/components/problem-solving/overview-panel";
import { SessionsPanel } from "@/components/problem-solving/sessions-panel";
import { SustainmentPanel } from "@/components/problem-solving/sustainment-panel";
import { VerificationPanel } from "@/components/problem-solving/verification-panel";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { ResourceComments, type CommentRow } from "@/components/comments/resource-comments";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MethodStage } from "@/lib/problem-solving/stages";
import type {
  ProblemSolvingAnalysis,
  ProblemSolvingAnalysisNode,
  ProblemSolvingCaseDetail,
  ProblemSolvingContainment,
  ProblemSolvingCurrentConditionItem,
  ProblemSolvingHypothesisTest,
  ProblemSolvingMethod,
} from "@/lib/problem-solving/types";

type CaseWorkspaceProps = {
  detail: ProblemSolvingCaseDetail;
  currentConditionItems: ProblemSolvingCurrentConditionItem[];
  containments: ProblemSolvingContainment[];
  analyses: ProblemSolvingAnalysis[];
  analysisNodes: ProblemSolvingAnalysisNode[];
  hypothesisTests: ProblemSolvingHypothesisTest[];
  methodStages: MethodStage[];
  methods: ProblemSolvingMethod[];
  comments: CommentRow[];
  evidence: EvidenceItem[];
  membershipNameById: Record<string, string>;
  ownerName?: string | null;
  facilitatorName?: string | null;
  canManage: boolean;
  canContribute: boolean;
  canFacilitate: boolean;
  canVerifyCause: boolean;
  canClose: boolean;
};

export function CaseWorkspace({
  detail,
  currentConditionItems,
  containments,
  analyses,
  analysisNodes,
  hypothesisTests,
  methodStages,
  methods,
  comments,
  evidence,
  membershipNameById,
  ownerName,
  facilitatorName,
  canManage,
  canContribute,
  canFacilitate,
  canVerifyCause,
  canClose,
}: CaseWorkspaceProps) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6" data-testid="problem-solving-workspace">
      <CaseHeader
        detail={detail}
        methodStages={methodStages}
        ownerName={ownerName ?? null}
        facilitatorName={facilitatorName ?? null}
        canManage={canManage}
        canFacilitate={canFacilitate}
        canClose={canClose}
        methods={methods.map((method) => ({ id: method.id, name: method.name }))}
        message={message}
        onMessage={setMessage}
      />

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="current-condition" data-testid="tab-current-condition">
            Current condition
          </TabsTrigger>
          <TabsTrigger value="containment" data-testid="tab-containment">
            Containment
          </TabsTrigger>
          <TabsTrigger value="cause-analysis" data-testid="tab-cause-analysis">
            Cause analysis
          </TabsTrigger>
          <TabsTrigger value="countermeasures" data-testid="tab-countermeasures">
            Countermeasures
          </TabsTrigger>
          <TabsTrigger value="verification" data-testid="tab-verification">
            Verification
          </TabsTrigger>
          <TabsTrigger value="sustainment" data-testid="tab-sustainment">
            Sustainment
          </TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-sessions">
            Sessions
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel
            detail={detail}
            evidence={evidence}
            canContribute={canContribute || canManage}
          />
          <Card className="mt-4">
            <CardContent className="pt-6">
              <ResourceComments resourceId={detail.id} comments={comments} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="current-condition">
          <CurrentConditionPanel
            caseId={detail.id}
            items={currentConditionItems}
            canContribute={canContribute || canManage}
          />
        </TabsContent>

        <TabsContent value="containment">
          <ContainmentPanel
            caseId={detail.id}
            containments={containments}
            canContribute={canContribute || canManage}
          />
        </TabsContent>

        <TabsContent value="cause-analysis">
          <CauseAnalysisPanel
            caseId={detail.id}
            detail={detail}
            analyses={analyses}
            analysisNodes={analysisNodes}
            hypothesisTests={hypothesisTests}
            canContribute={canContribute || canManage}
            canManage={canManage}
            canVerifyCause={canVerifyCause}
          />
        </TabsContent>

        <TabsContent value="countermeasures">
          <CountermeasuresPanel
            caseId={detail.id}
            detail={detail}
            canContribute={canContribute || canManage}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="verification">
          <VerificationPanel caseId={detail.id} detail={detail} canManage={canManage} />
        </TabsContent>

        <TabsContent value="sustainment">
          <SustainmentPanel
            caseId={detail.id}
            detail={detail}
            membershipNameById={membershipNameById}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsPanel
            caseId={detail.id}
            detail={detail}
            canFacilitate={canFacilitate || canManage}
            membershipNameById={membershipNameById}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryPanel detail={detail} membershipNameById={membershipNameById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
