import Link from "next/link";

import { EmptyState } from "@/components/platform/empty-state";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Footprints } from "lucide-react";

export default async function GembaOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const { data: definitions } = await supabase.from("gemba_definitions").select("id").limit(1);
  const { count: walkCount } = await supabase
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");
  const { count: observationCount } = await supabase
    .from("gemba_walk_observations")
    .select("id", { count: "exact", head: true });

  if (!definitions?.length) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Gemba walks" description="Structured walks with observations and follow-up." />
        <EmptyState
          title="No Gemba definitions yet"
          description="Create a Gemba walk template for your teams."
          icon={<Footprints className="size-5" />}
          actionLabel="Create definition"
          actionHref="/platform/gemba/definitions"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Gemba walks"
        description="Capture observations and improvement opportunities on the floor."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/schedule">Upcoming</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Completed walks" value={walkCount ?? 0} />
        <MetricCard label="Observations" value={observationCount ?? 0} />
      </div>
      <Card>
        <CardHeader><CardTitle>Quick links</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" asChild><Link href="/platform/gemba/definitions">Definitions</Link></Button>
          <Button variant="outline" asChild><Link href="/platform/gemba/history">History</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
