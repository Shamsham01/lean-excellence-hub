import { AppLink } from "@/components/ui/app-link";

export type SkillsMatrixGapRow = {
  membershipId: string;
  skillId: string;
  gap: {
    status?: string;
    current_order?: number;
    target_order?: number;
    gap?: number;
  } | null;
};

type SkillsMatrixProps = {
  memberships: Array<{ id: string; display_name: string | null }>;
  skills: Array<{ id: string; name: string }>;
  gaps: SkillsMatrixGapRow[];
};

function cellLabel(gap: SkillsMatrixGapRow["gap"] | undefined) {
  if (!gap) return "Not required";
  switch (gap.status) {
    case "meets_requirement":
      return "Meets requirement";
    case "below_requirement":
      return "Below requirement";
    case "above_requirement":
      return "Above requirement";
    case "not_assessed":
      return "Not assessed";
    case "incompatible_scale":
      return "Incompatible scale";
    case "not_required":
      return "Not required";
    default:
      return "Not required";
  }
}

function cellTone(status: string | undefined) {
  switch (status) {
    case "meets_requirement":
      return "text-success";
    case "above_requirement":
      return "text-information";
    case "below_requirement":
      return "text-warning-foreground";
    case "incompatible_scale":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

export function SkillsMatrix({ memberships, skills, gaps }: SkillsMatrixProps) {
  function gapFor(membershipId: string, skillId: string) {
    return gaps.find(
      (g) => g.membershipId === membershipId && g.skillId === skillId,
    )?.gap;
  }

  return (
    <div className="space-y-4" data-testid="skills-matrix">
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        data-testid="skills-matrix-legend"
      >
        <li>Not assessed</li>
        <li>Below requirement</li>
        <li>Meets requirement</li>
        <li>Above requirement</li>
        <li>Incompatible scale</li>
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 bg-muted/40 px-4 py-3 text-left">
                Person
              </th>
              {skills.map((skill) => (
                <th key={skill.id} className="px-3 py-3 text-left">
                  <AppLink
                    href={`/platform/skills/${skill.id}`}
                    className="hover:underline"
                    data-testid={`skills-matrix-skill-${skill.id}`}
                  >
                    {skill.name}
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
                      data-testid={`skills-matrix-person-${membership.id}`}
                    >
                      {personName}
                    </AppLink>
                  </td>
                  {skills.map((skill) => {
                    const gap = gapFor(membership.id, skill.id);
                    const label = cellLabel(gap);
                    const current = gap?.current_order;
                    const target = gap?.target_order;
                    return (
                      <td key={skill.id} className="px-3 py-3">
                        <span
                          className={`inline-flex min-h-11 flex-col items-start justify-center ${cellTone(gap?.status)}`}
                          aria-label={`${personName} — ${skill.name}: ${label}`}
                          data-testid={`skills-matrix-status-${membership.id}-${skill.id}`}
                          data-status={gap?.status ?? "not_required"}
                        >
                          <span>{label}</span>
                          {current != null && target != null ? (
                            <span className="text-xs text-muted-foreground">
                              {current} / {target}
                            </span>
                          ) : null}
                          {gap?.status === "below_requirement" &&
                          gap.gap != null ? (
                            <span className="text-xs text-muted-foreground">
                              Gap {gap.gap}
                            </span>
                          ) : null}
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
              data-testid={`skills-matrix-card-${membership.id}`}
            >
              <AppLink
                href={`/platform/people/${membership.id}`}
                className="font-medium hover:underline"
                data-testid={`skills-matrix-person-card-${membership.id}`}
              >
                {personName}
              </AppLink>
              <ul className="mt-2 space-y-2 text-sm">
                {skills.map((skill) => {
                  const gap = gapFor(membership.id, skill.id);
                  if (gap?.status === "not_required") return null;
                  const label = cellLabel(gap);
                  return (
                    <li key={skill.id} className="flex justify-between gap-2">
                      <AppLink
                        href={`/platform/skills/${skill.id}`}
                        className="min-w-0 hover:underline"
                      >
                        {skill.name}
                      </AppLink>
                      <span
                        className={`shrink-0 text-right ${cellTone(gap?.status)}`}
                        data-testid={`skills-matrix-status-${membership.id}-${skill.id}`}
                        data-status={gap?.status ?? "not_required"}
                      >
                        {label}
                      </span>
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
