import { PageHeader } from "@/components/platform/page-header";
import { ModuleReadError } from "@/components/workplace/module-read-error";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { RecognitionHistory } from "@/components/recognition/recognition-history";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { RECOGNITION_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function RecognitionPage() {
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: RECOGNITION_PERMISSIONS.read,
    module: "recognition",
    title: "Recognition",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const canAward = await currentMemberHasPermission("recognition.award");
  const canManage = await currentMemberHasPermission("recognition.manage");

  const { data: awards, error: awardsError } = await supabase
    .from("recognition_awards")
    .select(
      "id, title, message, recognition_type_name_snapshot, awarded_at, status",
    )
    .order("awarded_at", { ascending: false })
    .limit(50);

  if (awardsError) {
    return (
      <ModuleReadError
        title="Recognition"
        description="Meaningful contribution, recognised by people — not points."
        message="Recognition could not be loaded. Refresh the page and try again."
        module="recognition"
      />
    );
  }

  const history =
    awards?.map((award) => ({
      id: award.id,
      title: award.title,
      message: award.message,
      recognition_type_name: award.recognition_type_name_snapshot,
      awarded_at: award.awarded_at,
      status: award.status,
    })) ?? [];

  const feedItems = history.filter((award) => award.status === "active");

  return (
    <div className="flex flex-col gap-8" data-testid="recognition-feed">
      <PageHeader
        title="Recognition"
        description="Meaningful contribution, recognised by people — not points."
        actions={
          <div className="flex gap-2">
            {canAward ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/recognition/new"
                  data-testid="recognition-award-link"
                >
                  Award recognition
                </AppLink>
              </Button>
            ) : null}
            {canManage ? (
              <Button size="sm" variant="outline" asChild>
                <AppLink
                  href="/platform/recognition/types"
                  data-testid="recognition-types-link"
                >
                  Types
                </AppLink>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3">
        {feedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No recognition awards are available with your access. Awards shared
            with your site or organisation will appear here.
          </div>
        ) : (
          feedItems.map((item) => (
            <AppLink
              key={item.id}
              href={`/platform/recognition/${item.id}`}
              className="rounded-lg border border-l-4 border-border border-l-primary/40 bg-card px-4 py-4 shadow-xs hover:bg-surface"
              data-testid={`recognition-feed-item-${item.id}`}
            >
              <div
                className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                data-testid="recognition-feed-item"
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.message}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  <p>{item.recognition_type_name}</p>
                  <p>{new Date(item.awarded_at).toLocaleDateString("en-GB")}</p>
                </div>
              </div>
            </AppLink>
          ))
        )}
      </div>

      <RecognitionHistory awards={history} canManage={canManage} />
      <WorkplaceSharedRecords module="recognition" title="Recognition" />
    </div>
  );
}
