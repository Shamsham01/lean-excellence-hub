import Link from "next/link";
import { redirect } from "next/navigation";

import { createMaturityModel } from "../actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function MaturityModelsPage() {
  const canManage = await currentMemberHasPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );
  const supabase = await createServerSupabaseClient();
  const { data: models } = await supabase
    .from("maturity_models")
    .select("id, display_name, description, created_at")
    .order("created_at", { ascending: false });

  async function createAction(formData: FormData) {
    "use server";
    const result = await createMaturityModel(formData);
    if (result.modelId) {
      redirect(`/platform/maturity/models/${result.modelId}`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Maturity frameworks"
        description="Configure pillars, criteria, and assessment questions."
        actions={
          <Button variant="outline" asChild>
            <Link href="/platform/maturity">Back to overview</Link>
          </Button>
        }
      />

      {canManage ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="text-sm font-semibold">New framework</h2>
            <form action={createAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="Lean Excellence Framework" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <Button type="submit">Create draft framework</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        {models?.map((model) => (
          <Link
            key={model.id}
            href={`/platform/maturity/models/${model.id}`}
            className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted"
          >
            <p className="font-medium">{model.display_name}</p>
            {model.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
