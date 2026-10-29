import { randomUUID } from "node:crypto";

import { SkillsBuilderPanel } from "@/components/skills/setup/skills-builder-panel";
import { SkillsTerminologyNote } from "@/components/skills/setup/skills-terminology";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { leanAiPreparationSchema } from "@/modules/skills/setup/preparation";
import type { QuickStartPreparation } from "@/modules/skills/setup/preparation";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function freshPreparation(): QuickStartPreparation {
  return {
    idempotencyKey: randomUUID(),
    applicability: "organisation",
    unitIds: [],
    roleMappings: [],
    scaleResolution: "create",
  };
}

export default async function SkillsLeanAiSetupPage() {
  const access = await loadModuleSetupBuilderAccess({
    managePermission: SKILLS_PERMISSIONS.requirementsManage,
    requiredPermissions: [
      SKILLS_PERMISSIONS.catalogManage,
      SKILLS_PERMISSIONS.requirementsManage,
    ],
    moduleLabel: "Skills",
  });
  const supabase = await createServerSupabaseClient();
  const [{ data: jobFunctions }, { data: units }, { data: preparation }] =
    await Promise.all([
      supabase
        .from("job_functions")
        .select("id, name")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("organisation_units")
        .select("id, name")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("skill_setup_preparations")
        .select("state")
        .eq("source", "leanai")
        .eq("template_key", "leanai-skills-builder")
        .maybeSingle(),
    ]);
  const parsed = leanAiPreparationSchema.safeParse(preparation?.state);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Build Skills with LeanAI
      </h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Manual setup and LEH Quick Start stay available if LeanAI is off, out of
        quota, or unable to answer.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/skills/setup/manual">
            Continue manually
          </AppLink>
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink
            href="/platform/skills/setup/quick-start"
            data-testid="skills-builder-quick-start"
          >
            Use Quick Start
          </AppLink>
        </Button>
      </div>
      <SkillsTerminologyNote />
      <SkillsBuilderPanel
        initial={parsed.success ? parsed.data : freshPreparation()}
        jobFunctions={jobFunctions ?? []}
        units={units ?? []}
        unavailableMessage={
          access.available
            ? null
            : `${access.message} Manual setup and LEH Quick Start remain available.`
        }
      />
    </div>
  );
}
