import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatGembaWalkStatus } from "@/modules/operational/gemba-display";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaHistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: walks } = await supabase
    .from("gemba_walks")
    .select(
      "id, definition_name_snapshot, unit_name_snapshot, completed_at, summary_notes, status",
    )
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-8" data-testid="gemba-history-page">
      <PageHeader title="Gemba history" description="Completed walks." />
      <Card>
        <CardContent className="flex flex-col gap-2 py-6">
          {walks?.map((walk) => (
            <AppLink
              key={walk.id}
              href={`/platform/gemba/walks/${walk.id}`}
              className="rounded-md border border-border px-4 py-3 hover:bg-surface"
              data-testid={`gemba-history-link-${walk.id}`}
            >
              <p className="font-medium">{walk.definition_name_snapshot}</p>
              <p className="text-sm text-muted-foreground">
                {walk.unit_name_snapshot}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="success">
                  {formatGembaWalkStatus(walk.status)}
                </Badge>
                {walk.completed_at ? (
                  <span className="text-xs text-muted-foreground">
                    {new Date(walk.completed_at).toLocaleDateString("en-GB")}
                  </span>
                ) : null}
              </div>
            </AppLink>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
