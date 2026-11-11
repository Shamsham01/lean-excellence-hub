import {
  SkillsMatrix,
  type SkillsMatrixGapRow,
} from "@/components/skills/skills-matrix";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type MatrixPayload = {
  people?: Array<{ membership_id: string; display_name: string | null }>;
  skills?: Array<{ id: string; name: string }>;
  gaps?: Array<{
    membership_id: string;
    skill_id: string;
    gap: SkillsMatrixGapRow["gap"];
  }>;
  total_people?: number;
  page?: number;
  page_size?: number;
};

export default async function SkillsMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_skills_matrix", {
    target_page: page,
    target_page_size: 50,
  });

  const matrix = (error ? null : (data as MatrixPayload | null)) ?? null;
  const memberships = (matrix?.people ?? []).map((person) => ({
    id: person.membership_id,
    display_name: person.display_name,
  }));
  const skills = matrix?.skills ?? [];
  const gapRows: SkillsMatrixGapRow[] = (matrix?.gaps ?? []).map((row) => ({
    membershipId: row.membership_id,
    skillId: row.skill_id,
    gap: row.gap,
  }));

  const totalPeople = matrix?.total_people ?? memberships.length;
  const pageSize = matrix?.page_size ?? 50;
  const totalPages = Math.max(1, Math.ceil(totalPeople / pageSize));

  return (
    <div className="flex flex-col gap-8" data-testid="skills-matrix-page">
      <PageHeader
        title="Skills matrix"
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/skills"
              data-testid="skills-matrix-back-link"
            >
              Back to skills
            </AppLink>
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground" data-testid="skills-matrix-summary">
        Showing {memberships.length} of {totalPeople} people
        {skills.length > 0
          ? ` · ${skills.length} skill${skills.length === 1 ? "" : "s"} required on this page`
          : ""}
      </p>
      {!skills.length ? (
        <p className="max-w-xl text-sm text-muted-foreground">
          The matrix fills in after you publish a skills standard. Start from
          Skills if this organisation has not configured capability yet.
        </p>
      ) : null}
      <SkillsMatrix
        memberships={memberships}
        skills={skills}
        gaps={gapRows}
      />
      {totalPages > 1 ? (
        <nav
          className="flex flex-wrap items-center gap-3 text-sm"
          aria-label="Skills matrix pagination"
          data-testid="skills-matrix-pagination"
        >
          {page > 1 ? (
            <AppLink href={`/platform/skills/matrix?page=${page - 1}`}>
              Previous
            </AppLink>
          ) : null}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <AppLink href={`/platform/skills/matrix?page=${page + 1}`}>
              Next
            </AppLink>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
