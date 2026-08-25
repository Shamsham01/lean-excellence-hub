import { createTemplate } from "@/app/(platform)/platform/templates/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TemplatesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("id, display_name, description, experience_type, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Templates"
        description="Configurable forms and checklists for operational audits."
      />

      <Card>
        <CardHeader>
          <CardTitle>New template</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTemplate} className="flex flex-col gap-4 max-w-lg">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Name</Label>
              <Input id="displayName" name="displayName" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <Button type="submit">Create draft template</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {(templates ?? []).map((template) => (
          <Card key={template.id} className="bg-surface">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{template.display_name}</p>
                <Badge variant="outline">{template.experience_type}</Badge>
              </div>
              {template.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
