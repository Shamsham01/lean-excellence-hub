import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { AwardRecognitionForm } from "@/components/recognition/award-recognition-form";
import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewRecognitionPage({
  searchParams,
}: {
  searchParams: Promise<{ recipient?: string; source?: string; unit?: string }>;
}) {
  const canAward = await currentMemberHasPermission("recognition.award");
  if (!canAward) {
    notFound();
  }

  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: true,
  });
  const { data: types } = await supabase
    .from("recognition_types")
    .select("id, name")
    .eq("status", "active");

  const requestedUnitId =
    params.unit && selectorOptions.units.some((unit) => unit.id === params.unit)
      ? params.unit
      : undefined;
  const requestedRecipientId =
    params.recipient &&
    selectorOptions.people.some((person) => person.id === params.recipient)
      ? params.recipient
      : undefined;

  return (
    <div
      className="mx-auto flex max-w-xl flex-col gap-6"
      data-testid="award-recognition-page"
    >
      <PageHeader
        title="Award recognition"
        description="Recognise meaningful improvement contribution."
      />
      <AwardRecognitionForm
        types={types ?? []}
        units={selectorOptions.units}
        people={selectorOptions.people}
        requiresSiteSelection={selectorOptions.requiresSiteSelection}
        {...(requestedUnitId ? { defaultUnitId: requestedUnitId } : {})}
        {...(requestedRecipientId
          ? { defaultRecipientId: requestedRecipientId }
          : {})}
        {...(params.source ? { defaultSourceId: params.source } : {})}
      />
    </div>
  );
}
