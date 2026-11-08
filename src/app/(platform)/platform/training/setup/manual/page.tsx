import { randomUUID } from "node:crypto";

import { ManualTrainingSetupWizard } from "@/components/training/setup/manual-setup-wizard";
import { resumeTrainingPreparation } from "@/modules/training/setup/resume-preparation";
import { manualTrainingPreparationSchema } from "@/modules/training/setup/preparation";
import type { ManualTrainingPreparation } from "@/modules/training/setup/preparation";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function freshPreparation(): ManualTrainingPreparation {
  return {
    idempotencyKey: randomUUID(),
    step: "courses",
    title: "",
    courses: [
      {
        name: "",
        category: "",
        description: "",
        durationMinutes: "",
        deliveryMethod: "",
        learningObjectives: "",
      },
    ],
    includeCurriculum: false,
    curriculumName: "",
    curriculumDescription: "",
  };
}

export default async function TrainingManualSetupPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: preparation }, { data: courses }, { data: curricula }] =
    await Promise.all([
      supabase
        .from("training_setup_preparations")
        .select("state")
        .eq("source", "manual")
        .eq("template_key", "")
        .maybeSingle(),
      supabase.from("training_courses").select("code"),
      supabase.from("training_curricula").select("code"),
    ]);

  const initial = await resumeTrainingPreparation({
    source: "manual",
    templateKey: "",
    saved: preparation?.state,
    parse: (value) => {
      const parsed = manualTrainingPreparationSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
    fresh: freshPreparation,
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Manual training setup
      </h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Build a draft catalogue course by course. You can add an empty
        curriculum shell or assign requirements later.
      </p>
      <ManualTrainingSetupWizard
        initial={initial}
        existingCourseCodes={(courses ?? []).map((row) => row.code)}
        existingCurriculumCodes={(curricula ?? []).map((row) => row.code)}
      />
    </div>
  );
}
