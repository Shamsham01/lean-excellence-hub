import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingSessionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, title, status, scheduled_start")
    .order("scheduled_start", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-8" data-testid="training-sessions-page">
      <PageHeader
        title="Training sessions"
        description="Scheduled and completed training sessions."
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/training"
              data-testid="training-sessions-back-link"
            >
              Back to training
            </AppLink>
          </Button>
        }
      />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {sessions?.map((session) => (
            <AppLink
              key={session.id}
              href={`/platform/training/sessions/${session.id}`}
              className="flex min-h-11 items-center justify-between px-4 py-3 hover:bg-surface"
              data-testid={`training-session-link-${session.id}`}
            >
              <span>{session.title}</span>
              <span className="text-sm text-muted-foreground">
                {session.status}
              </span>
            </AppLink>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
