import { randomUUID } from "node:crypto";

import { ManualSkillsSetupWizard } from "@/components/skills/setup/manual-setup-wizard";
import { resumeSkillsPreparation } from "@/modules/skills/setup/resume-preparation";
import { manualSkillsPreparationSchema } from "@/modules/skills/setup/preparation";
import type { ManualSkillsPreparation } from "@/modules/skills/setup/preparation";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function freshPreparation(): ManualSkillsPreparation {
  return {
    idempotencyKey: randomUUID(),
    step: "scale",
    scaleName: "",
    scaleDescription:
      "Describes demonstrated ability. It is not a job grade or a training result.",
    levels: [
      {
        order: 0,
        label: "Aware",
        guidance: "Can describe the standard and the risks.",
      },
      { order: 1, label: "Developing", guidance: "Can perform with coaching." },
      {
        order: 2,
        label: "Competent",
        guidance: "Can perform independently to the standard.",
      },
    ],
    skills: [
      {
        name: "",
        category: "",
        evidence: "",
      },
    ],
    requirements: [],
    applicability: "organisation",
    unitIds: [],
    scaleResolution: "create",
  };
}

export default async function ManualSkillsSetupPage() {
  const supabase = await createServerSupabaseClient();
  const [
    { data: preparation },
    { data: jobFunctions },
    { data: units },
    { data: skills },
  ] = await Promise.all([
    supabase
      .from("skill_setup_preparations")
      .select("state")
      .eq("source", "manual")
      .eq("template_key", "")
      .maybeSingle(),
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
      .from("skills")
      .select("name")
      .eq("status", "active")
      .order("name")
      .limit(100),
  ]);
  const initial = await resumeSkillsPreparation({
    source: "manual",
    templateKey: "",
    saved: preparation?.state,
    parse: (value) => {
      const parsed = manualSkillsPreparationSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
    fresh: freshPreparation,
  });
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Guided Skills setup
      </h1>
      <ManualSkillsSetupWizard
        key={initial.idempotencyKey}
        initial={initial}
        jobFunctions={jobFunctions ?? []}
        units={units ?? []}
        existingSkillNames={(skills ?? []).map((skill) => skill.name)}
      />
    </div>
  );
}
