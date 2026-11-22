import { notFound } from "next/navigation";

import { DiscardTrainingSetupDraft } from "@/components/training/setup/discard-setup-draft";
import { PublishTrainingSetupDraft } from "@/components/training/setup/publish-setup-draft";
import { AppLink } from "@/components/ui/app-link";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingSetupDraftPage({
  params,
}: {
  params: Promise<{ bundleId: string }>;
}) {
  const { bundleId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: bundle } = await supabase
    .from("training_setup_bundles")
    .select(
      "id, title, status, source, sample, unresolved, curriculum_version_id",
    )
    .eq("id", bundleId)
    .maybeSingle();
  if (!bundle) {
    notFound();
  }
  const { data: items } = await supabase
    .from("training_setup_bundle_items")
    .select("record_kind, label, ownership")
    .eq("bundle_id", bundleId)
    .order("record_kind");

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="training-setup-draft"
    >
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {bundle.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {bundle.source} · {bundle.status}
          {bundle.sample ? " · sample" : ""}
        </p>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {(items ?? []).map((item) => (
          <li key={`${item.record_kind}-${item.label}`}>
            {item.record_kind}: {item.label}
          </li>
        ))}
      </ul>
      {bundle.status === "draft" ? (
        <div className="flex flex-wrap gap-3">
          <PublishTrainingSetupDraft bundleId={bundle.id} />
          <DiscardTrainingSetupDraft bundleId={bundle.id} />
        </div>
      ) : null}
      <AppLink href="/platform/training/setup" className="text-sm underline">
        Back to setup
      </AppLink>
    </div>
  );
}
