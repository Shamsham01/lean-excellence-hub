import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { RecognitionTypeManagement } from "@/components/recognition/recognition-type-management";
import { Button } from "@/components/ui/button";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function RecognitionTypesPage() {
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission("recognition.manage");

  if (!canManage) {
    return (
      <div className="text-sm text-muted-foreground">
        Recognition type management is not available for your role.
      </div>
    );
  }

  const { data: types } = await supabase
    .from("recognition_types")
    .select("id, name, code, description, status")
    .order("name");

  return (
    <div className="flex flex-col gap-8" data-testid="recognition-types-page">
      <PageHeader
        title="Recognition types"
        description="Define the kinds of contribution your organisation celebrates."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/recognition">Back to recognition</Link>
          </Button>
        }
      />
      <RecognitionTypeManagement types={types ?? []} />
    </div>
  );
}
