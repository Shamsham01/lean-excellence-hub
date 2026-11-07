import Link from "next/link";

import { AuthBackLink } from "@/components/auth/auth-back-link";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { AuthStatus } from "@/components/auth/auth-status";
import { LoginForm } from "@/components/auth/login-form";
import { loginErrorCopy } from "@/modules/identity/auth-copy";
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
  const errorCopy = error ? loginErrorCopy(error) : null;

  return (
    <AuthPageFrame>
      <AuthBackLink href="/">Back to home</AuthBackLink>
      <AuthPageHeader
        title="Sign in"
        description={
          invitationPreview?.organisationName
            ? `Sign in to accept your invitation to ${invitationPreview.organisationName}.`
            : "Choose how you want to access your organisation."
        }
      />
      {errorCopy ? (
        <AuthStatus testId="login-error" tone="danger" className="mb-4">
          <p>{errorCopy}</p>
          <p className="mt-2">
            <Link
              href="/recover"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Reset password
            </Link>
          </p>
        </AuthStatus>
      ) : null}
      <div className="mt-6 flex flex-col gap-6">
        <LoginForm
          next={next ?? null}
          {...(invitationPreview?.recipientEmail
            ? {
                defaultEmail: invitationPreview.recipientEmail,
                emailReadOnly: true,
              }
            : {})}
        />
        <footer className="flex flex-col gap-2 text-center text-sm">
          {invitationToken ? (
            <Link
              href={`/invitations/${invitationToken}/activate`}
              className="text-primary hover:underline"
            >
              Create an account from your invitation
            </Link>
          ) : null}
          <Link href="/signup" className="text-primary hover:underline">
            Create your account
          </Link>
          <Link
            href="/workforce-login"
            className="text-primary hover:underline"
          >
            Workforce sign in
          </Link>
        </footer>
      </div>
    </AuthPageFrame>
  );
}
