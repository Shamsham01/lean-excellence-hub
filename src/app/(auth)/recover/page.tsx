import Link from "next/link";

import { AuthBackLink } from "@/components/auth/auth-back-link";
import { AuthFieldLabel } from "@/components/auth/auth-field-label";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { AuthStatus } from "@/components/auth/auth-status";
import { requestRecovery } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_COPY } from "@/modules/identity/auth-copy";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    continue?: string;
  }>;
}) {
  const { sent, error, continue: continueRecovery } = await searchParams;
  const expired = error === "expired";
  const requested = sent === "true";
  const staged = continueRecovery === "true";

  return (
    <AuthPageFrame>
      <AuthBackLink href="/login">Back to sign in</AuthBackLink>
      <AuthPageHeader
        title="Recover access"
        description={AUTH_COPY.recoverDescription}
      />
      {requested ? (
        <AuthStatus testId="recover-sent" tone="info">
          {AUTH_COPY.recoverSent}
        </AuthStatus>
      ) : staged ? (
        <div className="mt-6 flex flex-col gap-4">
          <AuthStatus testId="recover-staged" tone="info">
            Your recovery link is ready. Continue below to verify it and choose
            a new password.
          </AuthStatus>
          <form action="/auth/recovery" method="post">
            <Button type="submit" className="w-full">
              Continue account recovery
            </Button>
          </form>
          <Link
            href="/recover"
            className="text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Request a different recovery email
          </Link>
        </div>
      ) : (
        <form action={requestRecovery} className="mt-6 flex flex-col gap-4">
          {expired ? (
            <AuthStatus testId="recover-expired" tone="danger">
              {AUTH_COPY.recoverExpired}
            </AuthStatus>
          ) : null}
          <div className="flex flex-col gap-2">
            <AuthFieldLabel htmlFor="email" required>
              Email
            </AuthFieldLabel>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" className="w-full">
            {expired ? "Request another recovery email" : "Send recovery email"}
          </Button>
        </form>
      )}
    </AuthPageFrame>
  );
}
