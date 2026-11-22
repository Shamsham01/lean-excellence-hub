import { notFound } from "next/navigation";

import { WorkplaceReadOnlyRecord } from "@/components/workplace/workplace-read-only-record";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  WORKPLACE_VIEW_PERMISSION,
  type WorkplaceModuleKey,
} from "@/modules/workplace/access";

const MODULE_TITLES: Record<WorkplaceModuleKey, string> = {
  maturity: "Maturity",
  five_s: "5S",
  gemba: "Gemba",
  actions: "Action",
  projects: "Project",
  benefits: "Benefit",
  problem_solving: "Problem solving",
  suggestions: "Suggestion",
  recognition: "Recognition",
  skills: "Skill",
  training: "Training",
};

function isWorkplaceModule(value: string): value is WorkplaceModuleKey {
  return Object.prototype.hasOwnProperty.call(MODULE_TITLES, value);
}

export default async function WorkplaceRecordPage({
  params,
}: {
  params: Promise<{ module: string; id: string }>;
}) {
  const { module, id } = await params;
  if (!isWorkplaceModule(module)) notFound();
  if (!(await currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION))) {
    notFound();
  }

  return (
    <WorkplaceReadOnlyRecord
      module={module}
      recordId={id}
      title={MODULE_TITLES[module]}
    />
  );
}
