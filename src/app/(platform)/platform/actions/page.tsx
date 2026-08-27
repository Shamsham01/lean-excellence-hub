import { createAction } from "@/app/(platform)/platform/actions/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ActionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: actions } = await supabase
    .from("actions")
    .select("id, title, status, priority, created_at, due_at")
    .order("created_at", { ascending: false });

  const openCount =
    actions?.filter((a) => a.status === "open" || a.status === "in_progress")
      .length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Actions"
        description="Improvement actions linked to assessments and operational work."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-surface">
          <CardContent className="p-4">
            <p className="typography-metric-label">Open</p>
            <p className="typography-metric-value">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface">
          <CardContent className="p-4">
            <p className="typography-metric-label">Total</p>
            <p className="typography-metric-value">{actions?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create action</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="flex max-w-lg flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Action title"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <Button type="submit">Create action</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {(actions ?? []).map((action) => (
          <div
            key={action.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
          >
            <div>
              <p className="font-medium">{action.title}</p>
              <p className="typography-metadata">
                {new Date(action.created_at).toLocaleDateString("en-GB")}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{action.status}</Badge>
              <Badge variant="secondary">{action.priority}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
