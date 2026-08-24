import { createTemplate } from "@/app/(platform)/platform/templates/actions";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TemplatesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("id, display_name, experience_type, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-2 text-muted-foreground">
          Versioned form foundation for future audits and assessments.
        </p>
      </div>

      <form
        action={createTemplate}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="text-lg font-medium">Create template draft</h2>
        <input
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
          name="displayName"
          placeholder="Template name"
          required
        />
        <textarea
          className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
          name="description"
          placeholder="Description (optional)"
        />
        <Button type="submit">Create template</Button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(templates ?? []).map((template) => (
          <li key={template.id} className="px-4 py-3">
            <p className="font-medium">{template.display_name}</p>
            <p className="text-sm text-muted-foreground">
              {template.experience_type}
            </p>
          </li>
        ))}
        {(templates ?? []).length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            No templates yet.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
