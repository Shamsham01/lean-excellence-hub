import { notFound, redirect } from "next/navigation";

import type { PlatformAccessDecision } from "./access-decision";
import type { PlatformConsoleAccess } from "./gate";

export function enforcePlatformConsole(
  access: PlatformConsoleAccess,
): asserts access is { kind: "allowed"; userId: string } {
  if (access.kind === "allowed") {
    return;
  }
  if (access.kind === "mfa") {
    redirect("/org_admin/mfa");
  }
  if (access.kind === "denied") {
    notFound();
  }
  if (access.kind === "rate_limited") {
    redirect("/org_admin/login?error=limited");
  }
  redirect("/org_admin/login");
}

export function enforcePlatformLoginEntry(decision: PlatformAccessDecision) {
  if (decision === "allowed") {
    redirect("/org_admin");
  }
  if (decision === "mfa") {
    redirect("/org_admin/mfa");
  }
  if (decision !== "anonymous") {
    notFound();
  }
}

export function enforcePlatformMfaEntry(decision: PlatformAccessDecision) {
  if (decision === "allowed") {
    redirect("/org_admin");
  }
  if (decision === "anonymous") {
    redirect("/org_admin/login");
  }
  if (decision !== "mfa") {
    notFound();
  }
}
