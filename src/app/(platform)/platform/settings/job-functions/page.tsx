import Link from "next/link";
import { notFound } from "next/navigation";

import { JobFunctionsList } from "@/components/job-functions/job-functions-list";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { createJobFunction } from "./actions";

export default async function JobFunctionsSettingsPage() {
  const canRead = await currentMemberHasPermission("job_functions.read");
  if (!canRead) {
    notFound();
  }

  const canManage = await currentMemberHasPermission("job_functions.manage");

  const supabase = await createServerSupabaseClient();
  const { data: jobFunctions } = await supabase
    .from("job_functions")
    .select("id, name, code, description, status")
    .eq("status", "active")
    .order("name");

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="job-functions-settings-page"
    >
      <PageHeader
        title="Job functions"
        description="Define what people do at work. Job functions support training and capability — they do not control application permissions."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/settings">Back to settings</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active job functions</CardTitle>
        </CardHeader>
        <CardContent>
          <JobFunctionsList
            jobFunctions={(jobFunctions ?? []).map((jobFunction) => ({
              id: jobFunction.id,
              name: jobFunction.name,
              code: jobFunction.code,
              description: jobFunction.description,
            }))}
            canManage={canManage}
            onCreate={createJobFunction}
          />
        </CardContent>
      </Card>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Ask an Organisation Administrator to configure job functions.
        </p>
      ) : null}
    </div>
  );
}
