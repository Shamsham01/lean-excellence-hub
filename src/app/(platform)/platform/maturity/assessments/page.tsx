import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { AssessmentStatusBadge } from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Button } from "@/components/ui/button";

export default async function AssessmentsListPage() {
  const supabase = await createServerSupabaseClient();
  const { data: assessments } = await supabase
    .from("maturity_assessments")
    .select("id, status, assessment_type, updated_at, unit_id")
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Assessments"
        description="Formal and self assessments across organisational units."
        actions={
          <Button asChild>
            <Link href="/platform/maturity/assessments/new">Start assessment</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2">
        {assessments?.map((a) => (
          <Link
            key={a.id}
            href={`/platform/maturity/assessments/${a.id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted"
          >
            <div>
              <p className="text-sm font-medium capitalize">
                {a.assessment_type.replace("_", " ")} assessment
              </p>
              <p className="typography-metadata">
                Updated {new Date(a.updated_at).toLocaleDateString("en-GB")}
              </p>
            </div>
            <AssessmentStatusBadge status={a.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
