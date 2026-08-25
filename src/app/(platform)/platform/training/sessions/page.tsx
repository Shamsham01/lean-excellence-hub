import { PageHeader } from "@/components/platform/page-header";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function TrainingSessionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, title, status, scheduled_start")
    .order("scheduled_start", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Training sessions" description="Scheduled and completed training sessions." />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {sessions?.map((session) => (
            <a
              key={session.id}
              href={`/platform/training/sessions/${session.id}`}
              className="flex min-h-11 items-center justify-between px-4 py-3 hover:bg-surface"
            >
              <span>{session.title}</span>
              <span className="text-sm text-muted-foreground">{session.status}</span>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
