import "server-only";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkplaceReadOnlyModule } from "@/components/workplace/workplace-read-only-module";
import { WorkplaceReadOnlyRecord } from "@/components/workplace/workplace-read-only-record";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

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

async function workplaceProjection(
  readPermission: string,
  denyWithoutAccess: boolean,
  projection: ReactNode,
): Promise<ReactNode | null> {
  if (await currentMemberHasPermission(readPermission)) {
    return null;
  }

  if (!(await currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION))) {
    if (!denyWithoutAccess) return null;
    notFound();
  }

  return projection;
}

export async function loadWorkplaceModuleView(input: {
  readPermission: string;
  module: WorkplaceModuleKey;
  title: string;
  denyWithoutAccess?: boolean;
}): Promise<ReactNode | null> {
  return workplaceProjection(
    input.readPermission,
    input.denyWithoutAccess !== false,
    <WorkplaceReadOnlyModule module={input.module} title={input.title} />,
  );
}

export async function loadWorkplaceRecordView(input: {
  readPermission: string;
  module: WorkplaceModuleKey;
  recordId: string;
  title: string;
  denyWithoutAccess?: boolean;
}): Promise<ReactNode | null> {
  return workplaceProjection(
    input.readPermission,
    input.denyWithoutAccess !== false,
    <WorkplaceReadOnlyRecord
      module={input.module}
      recordId={input.recordId}
      title={input.title}
    />,
  );
}
