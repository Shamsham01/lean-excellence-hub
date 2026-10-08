import { GembaActiveWalkList } from "@/components/gemba/active-walk-list";
import { EmptyState } from "@/components/platform/empty-state";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GEMBA_ACTIVE_WALK_LIVE_SELECT,
  mapActiveWalkRow,
} from "@/modules/operational/gemba-active-walks";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Footprints } from "lucide-react";

export default async function GembaOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.definitionsManage,
  );
  const { count: definitionCount } = await supabase
    .from("gemba_definitions")
    .select("id", { count: "exact", head: true });
  const { data: definitions } = await supabase
    .from("gemba_definitions")
    .select("id, display_name")
    .order("created_at", { ascending: false })
    .limit(5);
  const { count: walkCount } = await supabase
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");
  const { count: activeWalkCount } = await supabase
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");
  const { data: activeWalkRows } = await supabase
    .from("gemba_walks")
    .select(GEMBA_ACTIVE_WALK_LIVE_SELECT)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(20);
  const activeWalks = (activeWalkRows ?? []).map(mapActiveWalkRow);
  const { count: observationCount } = await supabase
    .from("gemba_walk_observations")
    .select("id", { count: "exact", head: true });

  if (!definitionCount) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Gemba walks"
          description="Structured walks with observations and follow-up."
        />
        <EmptyState
          title="No Gemba definitions yet"
          description="Choose how to start. Manual, LEH Quick Start, and LeanAI each create a draft you review before anything is published."
          icon={<Footprints className="size-5" />}
          {...(canManage
            ? {
                actionLabel: "Set up Gemba",
                actionHref: "/platform/gemba/setup",
              }
            : {})}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="gemba-overview-page">
      <PageHeader
        title="Gemba walks"
        description="Capture observations and improvement opportunities on the floor."
        actions={
          <>
            {canManage ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/gemba/setup"
                  data-testid="gemba-new-definition"
                >
                  New definition
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/schedule"
                data-testid="gemba-upcoming-link"
              >
                Upcoming
              </AppLink>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Walks in progress" value={activeWalkCount ?? 0} />
        <MetricCard label="Completed walks" value={walkCount ?? 0} />
        <MetricCard label="Observations" value={observationCount ?? 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Walks in progress</CardTitle>
        </CardHeader>
        <CardContent>
          <GembaActiveWalkList walks={activeWalks ?? []} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Definitions</CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-2"
          data-testid="gemba-definition-list"
        >
          {definitions?.map((definition) => (
            <AppLink
              key={definition.id}
              href={`/platform/gemba/definitions/${definition.id}`}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {definition.display_name}
            </AppLink>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" asChild>
            <AppLink href="/platform/gemba/definitions">Definitions</AppLink>
          </Button>
          <Button variant="outline" asChild>
            <AppLink href="/platform/gemba/history">History</AppLink>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
