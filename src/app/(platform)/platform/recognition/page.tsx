import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { RecognitionHistory } from "@/components/recognition/recognition-history";
import { Button } from "@/components/ui/button";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function RecognitionPage() {
  const supabase = await createServerSupabaseClient();
  const canAward = await currentMemberHasPermission("recognition.award");
  const canManage = await currentMemberHasPermission("recognition.manage");

  const { data: awards } = await supabase
    .from("recognition_awards")
    .select(
      "id, title, message, recognition_type_name_snapshot, awarded_at, status",
    )
    .order("awarded_at", { ascending: false })
    .limit(50);

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
                <Link href="/platform/recognition/new">Award recognition</Link>
              </Button>
            ) : null}
            {canManage ? (
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/recognition/types">Types</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3">
        {feedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No recognition awards yet. Meaningful contributions will appear here
            when awarded.
          </div>
        ) : (
          feedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-l-4 border-border border-l-primary/40 bg-card px-4 py-4 shadow-xs"
              data-testid="recognition-feed-item"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
            </div>
          ))
        )}
      </div>

      <RecognitionHistory awards={history} canManage={canManage} />
    </div>
  );
}
