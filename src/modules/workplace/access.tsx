import "server-only";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ModuleAccessLimited } from "@/components/workplace/module-access-limited";
import { WorkplaceReadOnlyModule } from "@/components/workplace/workplace-read-only-module";
import { WorkplaceReadOnlyRecord } from "@/components/workplace/workplace-read-only-record";
import {
  currentMemberHasGrantPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { decideWorkplaceAccess } from "@/modules/workplace/access-decision";

export const WORKPLACE_VIEW_PERMISSION = "workplace.view";

export type WorkplaceModuleKey =
  | "maturity"
  | "five_s"
  | "gemba"
  | "actions"
  | "projects"
  | "benefits"
  | "problem_solving"
  | "suggestions"
  | "recognition"
  | "skills"
  | "training";

type WorkplaceGateInput = {
  readPermission: string;
  title: string;
  denyWithoutAccess?: boolean;
  /**
   * Some modules still open their own workspace from baseline participation
   * because row-level security returns the caller's own records. Catalogue
   * modules leave this unset: baseline read is not authority to query them.
   */
  baselineOpensModule?: boolean;
};

async function resolveWorkplaceGate(
  input: WorkplaceGateInput,
  projection: ReactNode,
): Promise<ReactNode | null> {
  const [hasExplicitModuleRead, hasWorkplaceView, hasParticipationProbe] =
    await Promise.all([
      currentMemberHasGrantPermission(input.readPermission),
      currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION),
      currentMemberHasPermission(input.readPermission),
    ]);

  const decision = decideWorkplaceAccess({
    hasExplicitModuleRead,
    hasWorkplaceView,
    hasBaselineParticipation: hasParticipationProbe && !hasExplicitModuleRead,
    baselineOpensModule: input.baselineOpensModule === true,
  });

  if (decision === "module") return null;
  if (decision === "workplace") return projection;
  if (decision === "restricted" || input.denyWithoutAccess === false) {
    return <ModuleAccessLimited title={input.title} />;
  }

  notFound();
}

export async function loadWorkplaceModuleView(input: {
  readPermission: string;
  module: WorkplaceModuleKey;
  title: string;
  denyWithoutAccess?: boolean;
  baselineOpensModule?: boolean;
}): Promise<ReactNode | null> {
  return resolveWorkplaceGate(
    input,
    <WorkplaceReadOnlyModule module={input.module} title={input.title} />,
  );
}

export async function loadWorkplaceRecordView(input: {
  readPermission: string;
  module: WorkplaceModuleKey;
  recordId: string;
  title: string;
  denyWithoutAccess?: boolean;
  baselineOpensModule?: boolean;
}): Promise<ReactNode | null> {
  return resolveWorkplaceGate(
    input,
    <WorkplaceReadOnlyRecord
      module={input.module}
      recordId={input.recordId}
      title={input.title}
    />,
  );
}

export async function loadWorkplaceRecordFallback(input: {
  module: WorkplaceModuleKey;
  recordId: string;
  title: string;
}): Promise<ReactNode | null> {
  if (!(await currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION))) {
    return null;
  }

  return (
    <WorkplaceReadOnlyRecord
      module={input.module}
      recordId={input.recordId}
      title={input.title}
    />
  );
}
