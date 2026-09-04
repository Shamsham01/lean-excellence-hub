import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isInvitationPath } from "@/modules/identity/invitation-constants";
import { loadInvitationLifecycle } from "@/modules/identity/invitation-lifecycle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const invitationToken = isInvitationPath(next)
    ? (next?.replace(/^\/invitations\//, "").split("?")[0] ?? "")
    : null;
  const invitationPreview = invitationToken
    ? await loadInvitationLifecycle(invitationToken)
    : null;

  return (
    <AuthCard
      title="Sign in"
      description={
        invitationPreview?.organisationName
          ? `Sign in to accept your invitation to ${invitationPreview.organisationName}.`
          : "Choose how you want to access your organisation."
      }
      footer={
        <div className="flex flex-col gap-2 text-center text-sm">
          {invitationToken ? (
            <Link
              href={`/invitations/${invitationToken}/activate`}
              className="text-primary hover:underline"
            >
              Create an account from your invitation
            </Link>
          ) : null}
          <Link
            href="/workforce-login"
            className="text-primary hover:underline"
          >
            Workforce sign in
          </Link>
          <Link
            href="/recover"
            className="text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
      }
    >
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          Unable to sign in with those credentials.
        </p>
      ) : null}
      <form
        action="/api/auth/login"
        method="post"
        className="flex flex-col gap-4"
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={invitationPreview?.recipientEmail ?? undefined}
            readOnly={Boolean(invitationPreview?.recipientEmail)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Email sign in
        </Button>
      </form>
    </AuthCard>
  );
}
