"use client";

import { SessionsPanel } from "@/components/problem-solving/sessions-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type WorkshopModePanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  canFacilitate: boolean;
  membershipNameById: Record<string, string>;
};

export function WorkshopModePanel({
  caseId,
  detail,
  canFacilitate,
  membershipNameById,
}: WorkshopModePanelProps) {
  return (
    <Card data-testid="pps-workshop-mode">
      <CardHeader>
        <CardTitle className="text-base">Workshop mode (optional)</CardTitle>
        <CardDescription>
          Human team sessions are optional. Use them when you run a live
          workshop; Lean AI still drafts proposals you accept into the case.
          Sessions do not replace the guided stage flow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SessionsPanel
          caseId={caseId}
          detail={detail}
          canFacilitate={canFacilitate}
          membershipNameById={membershipNameById}
        />
      </CardContent>
    </Card>
  );
}
