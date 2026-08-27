import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaHistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: walks } = await supabase
    .from("gemba_walks")
    .select(
      "id, definition_name_snapshot, unit_name_snapshot, completed_at, summary_notes",
    )
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Gemba history" description="Completed walks." />
      <Card>
        <CardContent className="flex flex-col gap-2 py-6">
          {walks?.map((walk) => (
            <Link
              key={walk.id}
              href={`/platform/gemba/walks/${walk.id}`}
              className="rounded-md border border-border px-4 py-3 hover:bg-surface"
            >
              <p className="font-medium">{walk.definition_name_snapshot}</p>
              <p className="text-sm text-muted-foreground">
                {walk.unit_name_snapshot}
              </p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
