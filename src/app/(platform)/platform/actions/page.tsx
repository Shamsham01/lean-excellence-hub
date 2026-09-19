import { notFound } from "next/navigation";

import { ActionCreateForm } from "@/components/actions/action-create-form";
import { ActionList } from "@/components/actions/action-list";
import { PageHeader } from "@/components/platform/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ACTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ActionsPage() {
  const canRead = await currentMemberHasPermission(ACTIONS_PERMISSIONS.read);
  if (!canRead) notFound();

  const canCreate = await currentMemberHasPermission(
    ACTIONS_PERMISSIONS.create,
  );
  const supabase = await createServerSupabaseClient();
  const { data: actions } = await supabase
    .from("actions")
    .select("id, action_number, title, status, priority, created_at, due_at")
    .order("created_at", { ascending: false });

  const openCount =
    actions?.filter((a) => a.status === "open" || a.status === "in_progress")
      .length ?? 0;

  return (
    <div className="flex flex-col gap-8" data-testid="actions-page">
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

      {canCreate ? <ActionCreateForm /> : null}

      <ActionList actions={actions ?? []} />
    </div>
  );
}
