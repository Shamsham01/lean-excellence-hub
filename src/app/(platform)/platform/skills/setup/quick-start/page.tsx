import { randomUUID } from "node:crypto";

import { SkillsQuickStartForm } from "@/components/skills/setup/quick-start-form";
import { SkillsTerminologyNote } from "@/components/skills/setup/skills-terminology";
import { AppLink } from "@/components/ui/app-link";
import { resumeSkillsPreparation } from "@/modules/skills/setup/resume-preparation";
import { quickStartPreparationSchema } from "@/modules/skills/setup/preparation";
import type { QuickStartPreparation } from "@/modules/skills/setup/preparation";
import { skillsSetupUnitOptions } from "@/modules/skills/setup/unit-options";
import {
  isSkillsStarterPackKey,
  listSkillsStarterPacks,
  requireSkillsStarterPack,
} from "@/modules/skills/templates/catalogue";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function freshPreparation(packKey: string): QuickStartPreparation {
  const pack = requireSkillsStarterPack(packKey);
  return {
    idempotencyKey: randomUUID(),
    applicability: "organisation",
    unitIds: [],
    roleMappings: pack.suggestedRoles.map((role) => ({
      suggestedRole: role.title,
      jobFunctionId: null,
    })),
    scaleResolution: "create",
  };
}

export default async function SkillsQuickStartPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const params = await searchParams;
  const packs = listSkillsStarterPacks();
  const selected = isSkillsStarterPackKey(params.pack ?? "")
    ? params.pack!
    : null;
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
        .select("id, name, parent_unit_id")
        .eq("status", "active")
        .order("name"),
      selected
        ? supabase
            .from("skill_setup_preparations")
            .select("state")
            .eq("source", "quick_start")
            .eq("template_key", selected)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-quick-start"
    >
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          LEH Quick Start
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a sample pack, map its suggested roles to job functions you
          already have, preview the draft, then create it. Quick Start does not
          need LeanAI.
        </p>
      </div>
      <SkillsTerminologyNote />
      <div className="flex flex-col gap-2 sm:flex-row">
        {packs.map((pack) => (
          <AppLink
            key={pack.key}
            href={`/platform/skills/setup/quick-start?pack=${pack.key}`}
            className="rounded-md border border-border px-4 py-3 text-sm font-medium"
            data-testid={`skills-pack-${pack.key}`}
          >
            {pack.name}
          </AppLink>
        ))}
      </div>
      {selected ? (
        <SkillsQuickStartForm
          pack={requireSkillsStarterPack(selected)}
          initial={await resumeSkillsPreparation({
            source: "quick_start",
            templateKey: selected,
            saved: preparation?.state,
            parse: (value) => {
              const parsed = quickStartPreparationSchema.safeParse(value);
              return parsed.success ? parsed.data : null;
            },
            fresh: () => freshPreparation(selected),
          })}
          jobFunctions={jobFunctions ?? []}
          units={skillsSetupUnitOptions(units ?? [])}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Select general manufacturing or food production. Food production is a
          local starting point, not a certification.
        </p>
      )}
    </div>
  );
}
