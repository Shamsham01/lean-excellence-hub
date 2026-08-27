import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { AwardRecognitionForm } from "@/components/recognition/award-recognition-form";
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
  const { data: types } = await supabase
    .from("recognition_types")
    .select("id, name")
    .eq("status", "active");

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
        organisationalUnitId={params.unit ?? ""}
        {...(params.recipient ? { defaultRecipientId: params.recipient } : {})}
        {...(params.source ? { defaultSourceId: params.source } : {})}
      />
    </div>
  );
}
