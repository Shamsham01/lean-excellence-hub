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
  if (!gap) return "Not Required";
  switch (gap.status) {
    case "meets_requirement":
      return "Meets requirement";
    case "below_requirement":
      return `Gap: ${gap.gap ?? 0}`;
    case "above_requirement":
      return "Above requirement";
    case "not_assessed":
      return "Not assessed";
    case "incompatible_scale":
      return "Incompatible scale";
    default:
      return "Not Required";
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
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 bg-muted/40 px-4 py-3 text-left">
                Person
              </th>
              {skills.map((skill) => (
                <th key={skill.id} className="px-3 py-3 text-left">
                  {skill.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberships.map((membership) => (
              <tr key={membership.id} className="border-b border-border">
                <td className="sticky left-0 bg-card px-4 py-3 font-medium">
                  {membership.display_name}
                </td>
                {skills.map((skill) => {
                  const gap = gapFor(membership.id, skill.id);
                  const label = cellLabel(gap);
                  const current = gap?.current_order;
                  const target = gap?.target_order;
                  return (
                    <td key={skill.id} className="px-3 py-3">
                      <span
                        className="inline-flex min-h-11 flex-col items-start justify-center"
                        aria-label={`${membership.display_name} — ${skill.name}: ${label}`}
                      >
                        <span>{label}</span>
                        {current != null && target != null ? (
                          <span className="text-xs text-muted-foreground">
                            {current} / {target}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {memberships.map((membership) => (
          <div
            key={membership.id}
            className="rounded-lg border border-border p-4"
            data-testid={`skills-matrix-card-${membership.id}`}
          >
            <p className="font-medium">{membership.display_name}</p>
            <ul className="mt-2 space-y-2 text-sm">
              {skills.map((skill) => {
                const gap = gapFor(membership.id, skill.id);
                if (gap?.status === "not_required") return null;
                const label = cellLabel(gap);
                return (
                  <li key={skill.id} className="flex justify-between gap-2">
                    <span>{skill.name}</span>
                    <span className="text-muted-foreground">{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
