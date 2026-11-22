import { TrainingMatrix } from "@/components/training/training-matrix";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/alert";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type TrainingMatrixPayload = {
  people?: Array<{ membership_id: string; display_name: string | null }>;
  courses?: Array<{ id: string; name: string }>;
  requirements?: Array<{
    membership_id: string;
    course_id: string;
    mandatory: boolean;
  }>;
  completions?: Array<{
    membership_id: string;
    course_id: string;
    status: string;
    expires_at: string | null;
  }>;
  total_people?: number;
  page?: number;
  page_size?: number;
};

export default async function TrainingMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_training_matrix", {
    target_page: page,
    target_page_size: 50,
  });

  if (error) {
    return (
      <div className="flex flex-col gap-8" data-testid="training-matrix-page">
        <PageHeader title="Training matrix" />
        <InlineAlert tone="error" data-testid="training-matrix-error">
          We could not load the training matrix. Try again or contact your
          administrator if this keeps happening.
        </InlineAlert>
      </div>
    );
  }

  const matrix = (data as TrainingMatrixPayload | null) ?? null;
  const memberships = (matrix?.people ?? []).map((person) => ({
    id: person.membership_id,
    display_name: person.display_name,
  }));
  const courses = matrix?.courses ?? [];
  const requirements = matrix?.requirements ?? [];
  const completions = matrix?.completions ?? [];

  const totalPeople = matrix?.total_people ?? memberships.length;
  const pageSize = matrix?.page_size ?? 50;
  const totalPages = Math.max(1, Math.ceil(totalPeople / pageSize));

  return (
    <div className="flex flex-col gap-8" data-testid="training-matrix-page">
      <PageHeader
        title="Training matrix"
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/training"
              data-testid="training-matrix-back-link"
            >
              Back to training
            </AppLink>
          </Button>
        }
      />
      <p
        className="text-sm text-muted-foreground"
        data-testid="training-matrix-summary"
      >
        Showing {memberships.length} of {totalPeople} people
        {courses.length > 0
          ? ` · ${courses.length} course${courses.length === 1 ? "" : "s"} required on this page`
          : ""}
      </p>
      <TrainingMatrix
        memberships={memberships}
        courses={courses}
        requirements={requirements}
        completions={completions}
      />
      {totalPages > 1 ? (
        <nav
          className="flex flex-wrap items-center gap-3 text-sm"
          aria-label="Training matrix pagination"
          data-testid="training-matrix-pagination"
        >
          {page > 1 ? (
            <AppLink href={`/platform/training/matrix?page=${page - 1}`}>
              Previous
            </AppLink>
          ) : null}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <AppLink href={`/platform/training/matrix?page=${page + 1}`}>
              Next
            </AppLink>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
