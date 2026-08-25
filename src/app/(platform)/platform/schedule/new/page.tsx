import Link from "next/link";
import { notFound } from "next/navigation";

import { createScheduleFromForm } from "@/app/(platform)/platform/schedule/actions";
import { PageHeader } from "@/components/platform/page-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { Button } from "@/components/ui/button";
import { loadScheduleFormContext } from "@/lib/schedule/form-context";
import { SCHEDULE_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    activityId?: string;
    activityLabel?: string;
    returnTo?: string;
  }>;
}) {
  const params = await searchParams;
  const canManage = await currentMemberHasPermission(
    SCHEDULE_PERMISSIONS.manage,
  );
  if (!canManage) notFound();

  const { timezone, units, memberships } = await loadScheduleFormContext();
  const supabase = await createServerSupabaseClient();

  const activityResourceId = params.activityId ?? "";
  let activityLabel = params.activityLabel ?? "Scheduled activity";

  if (activityResourceId && !params.activityLabel) {
    const { data: fiveS } = await supabase
      .from("five_s_standards")
      .select("display_name")
      .eq("id", activityResourceId)
      .maybeSingle();
    if (fiveS?.display_name) {
      activityLabel = fiveS.display_name;
    } else {
      const { data: gemba } = await supabase
        .from("gemba_definitions")
        .select("display_name")
        .eq("id", activityResourceId)
        .maybeSingle();
      if (gemba?.display_name) activityLabel = gemba.display_name;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Create schedule"
        description="Set up a recurring operational activity."
        actions={
          <Button variant="outline" size="sm" asChild className="min-h-11">
            <Link href={params.returnTo ?? "/platform/schedule"}>Back</Link>
          </Button>
        }
      />

      {activityResourceId ? (
        <ScheduleForm
          action={createScheduleFromForm}
          activityResourceId={activityResourceId}
          activityLabel={activityLabel}
          timezone={timezone}
          units={units}
          memberships={memberships}
          returnTo={params.returnTo ?? "/platform/schedule"}
          submitLabel="Create schedule"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Select a 5S standard or Gemba definition to schedule, or pass an
          activity id in the URL.
        </p>
      )}
    </div>
  );
}
