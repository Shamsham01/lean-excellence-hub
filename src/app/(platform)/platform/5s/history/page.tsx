import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function FiveSHistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: audits } = await supabase
    .from("five_s_audits")
    .select(
      "id, status, overall_score_percent, target_percent, result_status, standard_name_snapshot, unit_name_snapshot, completed_at, auditor_membership_id",
    )
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="5S history"
        description="Completed audits with immutable scores."
      />
      <Card>
        <CardContent className="flex flex-col gap-2 py-6">
          {audits?.length ? (
            audits.map((audit) => (
              <Link
                key={audit.id}
                href={`/platform/5s/audits/${audit.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3 hover:bg-surface"
              >
                <div>
                  <p className="font-medium">
                    {audit.standard_name_snapshot ?? "5S audit"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {audit.unit_name_snapshot}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{audit.overall_score_percent}%</p>
                  <p className="text-muted-foreground">{audit.result_status}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No completed audits yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
