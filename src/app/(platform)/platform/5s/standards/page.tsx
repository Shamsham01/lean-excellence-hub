import Link from "next/link";
import { redirect } from "next/navigation";

import { createFiveSStandard } from "@/app/(platform)/platform/5s/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function FiveSStandardsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: standards } = await supabase
    .from("five_s_standards")
    .select("id, display_name, description, created_at")
    .order("created_at", { ascending: false });

  async function createAction(formData: FormData) {
    "use server";
    const result = await createFiveSStandard(formData);
    if (result.standardId) {
      redirect(`/platform/5s/standards/${result.standardId}`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="5S standards" description="Configurable audit templates per area." />

      <Card>
        <CardHeader>
          <CardTitle>Create standard</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="flex flex-col gap-4 max-w-lg">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required className="mt-2 min-h-11" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="threshold">Target threshold (%)</Label>
              <Input id="threshold" name="threshold" type="number" defaultValue={90} className="mt-2" />
            </div>
            <Button type="submit" className="min-h-11">Create draft standard</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standards</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {standards?.map((s) => (
            <Link
              key={s.id}
              href={`/platform/5s/standards/${s.id}`}
              className="rounded-md border border-border px-4 py-3 hover:bg-surface"
            >
              <p className="font-medium">{s.display_name}</p>
              {s.description ? (
                <p className="text-sm text-muted-foreground">{s.description}</p>
              ) : null}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
