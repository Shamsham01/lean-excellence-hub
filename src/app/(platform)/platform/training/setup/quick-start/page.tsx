import { randomUUID } from "node:crypto";

import { TrainingQuickStartForm } from "@/components/training/setup/quick-start-form";
import { TrainingTerminologyNote } from "@/components/training/setup/training-terminology";
import { AppLink } from "@/components/ui/app-link";
import { resumeTrainingPreparation } from "@/modules/training/setup/resume-preparation";
import { quickStartPreparationSchema } from "@/modules/training/setup/preparation";
import type { QuickStartPreparation } from "@/modules/training/setup/preparation";
import {
  isTrainingStarterPackKey,
  listTrainingStarterPacks,
  requireTrainingStarterPack,
} from "@/modules/training/templates/catalogue";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function freshPreparation(packKey: string): QuickStartPreparation {
  const pack = requireTrainingStarterPack(packKey);
  return {
    idempotencyKey: randomUUID(),
    roleMappings: pack.suggestedRoles.map((role) => ({
      suggestedRole: role.title,
      jobFunctionId: null,
    })),
  };
}

export default async function TrainingQuickStartPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const params = await searchParams;
  const packs = listTrainingStarterPacks();
  const selected = isTrainingStarterPackKey(params.pack ?? "")
    ? params.pack!
    : (packs[0]?.key ?? null);
  const supabase = await createServerSupabaseClient();
  const [
    { data: jobFunctions },
    { data: preparation },
    { data: courses },
    { data: curricula },
  ] = await Promise.all([
    supabase
      .from("job_functions")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    selected
      ? supabase
          .from("training_setup_preparations")
          .select("state")
          .eq("source", "quick_start")
          .eq("template_key", selected)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("training_courses").select("code"),
    supabase.from("training_curricula").select("code"),
  ]);

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="training-quick-start"
    >
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          LEH Quick Start
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Deploy a sample manufacturing training pack as an organisation-owned
          draft.
        </p>
      </div>
      <TrainingTerminologyNote />
      <div className="flex flex-col gap-2 sm:flex-row">
        {packs.map((pack) => (
          <AppLink
            key={pack.key}
            href={`/platform/training/setup/quick-start?pack=${pack.key}`}
            className="rounded-md border border-border px-4 py-3 text-sm font-medium"
            data-testid={`training-pack-${pack.key}`}
          >
            {pack.name}
          </AppLink>
        ))}
      </div>
      {selected ? (
        <TrainingQuickStartForm
          pack={requireTrainingStarterPack(selected)}
          initial={await resumeTrainingPreparation({
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
          existingCourseCodes={(courses ?? []).map((row) => row.code)}
          existingCurriculumCodes={(curricula ?? []).map((row) => row.code)}
        />
      ) : null}
    </div>
  );
}
