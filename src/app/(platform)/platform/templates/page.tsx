import { CreateTemplateDialog } from "@/app/(platform)/platform/templates/create-template-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TemplatesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("id, display_name, description, experience_type, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8" data-testid="templates-page">
      <PageHeader title="Templates" actions={<CreateTemplateDialog />} />

      <div className="grid gap-3 sm:grid-cols-2">
        {(templates ?? []).map((template) => (
          <Card key={template.id} className="bg-surface">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{template.display_name}</p>
                <Badge variant="outline">{template.experience_type}</Badge>
              </div>
              {template.description ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">
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
