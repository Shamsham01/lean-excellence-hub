type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "information";

export type MembershipStatusPresentation = {
  label: string;
  variant: BadgeVariant;
  className?: string;
};

export function membershipStatusPresentation(
  status: string,
): MembershipStatusPresentation {
  switch (status) {
    case "active":
      return { label: "Active", variant: "success" };
    case "pending":
      return {
        label: "Invited / onboarding",
        variant: "outline",
        className:
          "border-[color:var(--leh-accent)]/35 bg-[color:var(--leh-accent)]/10 text-[color:var(--leh-accent)]",
      };
    case "inactive":
      return { label: "Inactive", variant: "destructive" };
    default:
      return { label: status, variant: "secondary" };
  }
}

export function peopleDirectoryContactLine(person: {
  email: string | null;
  notification_email: string | null;
  username: string | null;
  is_workforce_account?: boolean;
}): string {
  if (person.is_workforce_account && person.username) {
    return person.username;
  }
  const email = person.notification_email ?? person.email;
  return email?.trim() || "—";
}

export function peopleDirectoryRoleLabel(person: {
  job_function_name: string | null;
  job_title: string | null;
}): string {
  return (
    person.job_function_name?.trim() ||
    person.job_title?.trim() ||
    "No job function"
  );
}
