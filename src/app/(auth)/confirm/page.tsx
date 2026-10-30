import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthStatus } from "@/components/auth/auth-status";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Confirm email",
  robots: { index: false, follow: false },
};

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ continue?: string }>;
}) {
  const { continue: continueConfirmation } = await searchParams;
  const staged = continueConfirmation === "true";

  return (
    <AuthCard
      title="Confirm email address"
      description="Confirm this email address to continue. Confirmation does not join an organisation or grant access."
      footer={
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {staged ? (
        <div className="flex flex-col gap-4">
          <AuthStatus testId="confirm-staged" tone="info">
            Your confirmation link is ready. Confirm below to continue. This
            does not accept an organisation invitation.
          </AuthStatus>
          <form action="/auth/confirm" method="post">
            <Button type="submit" className="w-full">
              Confirm email and continue
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="confirm-missing">
          <p className="text-sm text-muted-foreground">
            Open the confirmation link from your email, then confirm it on this
            page.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
