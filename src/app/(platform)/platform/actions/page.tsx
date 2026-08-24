import { createAction } from "@/app/(platform)/platform/actions/actions";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ActionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: actions } = await supabase
    .from("actions")
    .select("id, title, status, priority, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Actions</h1>
        <p className="mt-2 text-muted-foreground">
          Universal actions shared across future Lean modules.
        </p>
      </div>

      <form
        action={createAction}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="text-lg font-medium">Create action</h2>
        <input
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
          name="title"
          placeholder="Action title"
          required
        />
        <textarea
          className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
          name="description"
          placeholder="Description (optional)"
        />
        <Button type="submit">Create action</Button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(actions ?? []).map((action) => (
          <li key={action.id} className="px-4 py-3">
            <p className="font-medium">{action.title}</p>
            <p className="text-sm text-muted-foreground">
              {action.status} · {action.priority}
            </p>
          </li>
        ))}
        {(actions ?? []).length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            No actions yet.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
