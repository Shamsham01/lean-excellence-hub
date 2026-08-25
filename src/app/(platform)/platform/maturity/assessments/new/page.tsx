import { redirect } from "next/navigation";

import { startAssessment } from "../../actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ versionId?: string }>;
}) {
  const { versionId } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data: versions } = await supabase
    .from("maturity_model_versions")
    .select("id, version_number, model_id, maturity_models(display_name)")
    .eq("status", "published")
    .order("version_number", { ascending: false });

  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, name, code")
    .eq("status", "active")
    .order("name");

  async function action(formData: FormData) {
    "use server";
    const result = await startAssessment(formData);
    if (result.assessmentId) {
      redirect(`/platform/maturity/assessments/${result.assessmentId}`);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <PageHeader
        title="Start assessment"
        description="Select framework version, organisational unit, and assessment type."
      />
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="modelVersionId">Framework version</Label>
          <select
            id="modelVersionId"
            name="modelVersionId"
            required
            className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
            defaultValue={versionId ?? ""}
          >
            <option value="" disabled>
              Select version
            </option>
            {versions?.map((v) => (
              <option key={v.id} value={v.id}>
                {(v.maturity_models as { display_name: string } | null)
                  ?.display_name ?? "Framework"}
                {" — Version "}
                {v.version_number}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="unitId">Organisational unit</Label>
          <select
            id="unitId"
            name="unitId"
            required
            className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
          >
            <option value="" disabled>
              Select unit
            </option>
            {units?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="assessmentType">Assessment type</Label>
          <select
            id="assessmentType"
            name="assessmentType"
            required
            className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
          >
            <option value="self">Self assessment</option>
            <option value="formal">Formal assessment</option>
          </select>
        </div>
        <Button type="submit">Start</Button>
      </form>
    </div>
  );
}
