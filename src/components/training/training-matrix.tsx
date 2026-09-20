import { AppLink } from "@/components/ui/app-link";
import {
  deriveTrainingCompletionValidityState,
  trainingMatrixCellLabel,
} from "@/lib/training/status";

type TrainingMatrixProps = {
  memberships: Array<{ id: string; display_name: string | null }>;
  courses: Array<{ id: string; name: string }>;
  requirements: Array<{ id: string; course_id: string; mandatory: boolean }>;
  completions: Array<{
    membership_id: string;
    course_id: string;
    status: string;
    expires_at: string | null;
  }>;
};

export function TrainingMatrix({
  memberships,
  courses,
  requirements,
  completions,
}: TrainingMatrixProps) {
  const requiredCourseIds = new Set(
    requirements.filter((r) => r.mandatory).map((r) => r.course_id),
  );

  function cellFor(membershipId: string, courseId: string) {
    const isRequired = requiredCourseIds.has(courseId);
    const completion = completions.find(
      (c) => c.membership_id === membershipId && c.course_id === courseId,
    );
    const validity = completion
      ? deriveTrainingCompletionValidityState(
          completion.status,
          completion.expires_at,
        )
      : "none";
    const isSatisfied =
      completion?.status === "completed" &&
      (validity === "valid" || validity === "expiring");
    const label = trainingMatrixCellLabel(isRequired, isSatisfied, validity);
    return { label, validity, isRequired, isSatisfied };
  }

  return (
    <div className="space-y-4" data-testid="training-matrix">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Completed</span>
        <span>Required</span>
        <span>Expiring</span>
        <span>Expired</span>
        <span>Not Required</span>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 bg-muted/40 px-4 py-3 text-left font-medium">
                Person
              </th>
              {courses.map((course) => (
                <th key={course.id} className="px-3 py-3 text-left font-medium">
                  <AppLink
                    href={`/platform/training/courses/${course.id}`}
                    className="hover:underline"
                    data-testid={`training-matrix-course-${course.id}`}
                  >
                    {course.name}
                  </AppLink>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberships.map((membership) => {
              const personName = membership.display_name ?? "Person";
              return (
                <tr key={membership.id} className="border-b border-border">
                  <td className="sticky left-0 bg-card px-4 py-3 font-medium">
                    <AppLink
                      href={`/platform/people/${membership.id}`}
                      className="hover:underline"
                      data-testid={`training-matrix-person-${membership.id}`}
                    >
                      {personName}
                    </AppLink>
                  </td>
                  {courses.map((course) => {
                    const cell = cellFor(membership.id, course.id);
                    return (
                      <td key={course.id} className="px-3 py-3">
                        <span
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs"
                          aria-label={`${personName} — ${course.name}: ${cell.label}`}
                        >
                          {cell.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {memberships.map((membership) => {
          const personName = membership.display_name ?? "Person";
          return (
            <div
              key={membership.id}
              className="rounded-lg border border-border p-4"
            >
              <AppLink
                href={`/platform/people/${membership.id}`}
                className="font-medium hover:underline"
                data-testid={`training-matrix-person-card-${membership.id}`}
              >
                {personName}
              </AppLink>
              <ul className="mt-2 space-y-1 text-sm">
                {courses
                  .filter((c) => requiredCourseIds.has(c.id))
                  .map((course) => {
                    const cell = cellFor(membership.id, course.id);
                    return (
                      <li
                        key={course.id}
                        className="flex justify-between gap-2"
                      >
                        <AppLink
                          href={`/platform/training/courses/${course.id}`}
                          className="hover:underline"
                        >
                          {course.name}
                        </AppLink>
                        <span>{cell.label}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
