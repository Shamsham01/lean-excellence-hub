import Link from "next/link";
import { notFound } from "next/navigation";

import { JobFunctionCreateForm } from "@/components/job-functions/job-function-create-form";
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
        description="Define the roles people perform in your organisation."
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
          {jobFunctions?.length ? (
            <ul className="flex flex-col gap-2">
              {jobFunctions.map((jobFunction) => (
                <li
                  key={jobFunction.id}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {jobFunction.name}
                  </p>
                  <p className="text-muted-foreground">{jobFunction.code}</p>
                  {jobFunction.description ? (
                    <p className="mt-1 text-muted-foreground">
                      {jobFunction.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No job functions yet.
            </p>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create job function</CardTitle>
          </CardHeader>
          <CardContent>
            <JobFunctionCreateForm onCreate={createJobFunction} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask an Organisation Administrator to configure job functions.
        </p>
      )}
    </div>
  );
}
