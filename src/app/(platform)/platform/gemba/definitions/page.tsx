import Link from "next/link";
import { redirect } from "next/navigation";

import { createGembaDefinition } from "@/app/(platform)/platform/gemba/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaDefinitionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: definitions } = await supabase
    .from("gemba_definitions")
    .select("id, display_name, description")
    .order("created_at", { ascending: false });

  async function createAction(formData: FormData) {
    "use server";
    const result = await createGembaDefinition(formData);
    if (result.definitionId) {
      redirect(`/platform/gemba/definitions/${result.definitionId}`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Gemba definitions"
        description="Templates for structured walks."
      />
      <Card>
        <CardHeader>
          <CardTitle>Create definition</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="flex max-w-lg flex-col gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required className="mt-2 min-h-11" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" className="mt-2" />
            </div>
            <Button type="submit" className="min-h-11">
              Create draft
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Definitions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {definitions?.map((d) => (
            <Link
              key={d.id}
              href={`/platform/gemba/definitions/${d.id}`}
              className="rounded-md border border-border px-4 py-3 hover:bg-surface"
            >
              <p className="font-medium">{d.display_name}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
