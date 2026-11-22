import Link from "next/link";

import { AuthBackLink } from "@/components/auth/auth-back-link";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { SignupForm } from "@/components/auth/signup-form";
import { InlineAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { createFoundingAccount } from "./actions";

export default async function FoundingSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;

  if (status === "check-email") {
    return (
      <AuthPageFrame>
        <AuthBackLink href="/">Back to home</AuthBackLink>
        <AuthPageHeader
          title="Check your email"
          description="If this is a new account, we've sent a confirmation link. If you already have an account, sign in or reset your password."
        />
        <div
          className="mt-6 flex flex-col gap-2"
          data-testid="founding-signup-check-email"
        >
          <Button className="w-full" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/recover">Forgot password?</Link>
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/signup">Use a different email</Link>
          </Button>
        </div>
      </AuthPageFrame>
    );
  }

  return (
    <AuthPageFrame>
      <AuthBackLink href="/login">Back to sign in</AuthBackLink>
      <AuthPageHeader
        title="Create your account"
        description="Create a founder account first. Organisation setup follows after you confirm your email. Joining an existing organisation still requires an invitation."
      />
      <div className="mt-6 flex flex-col gap-4">
        {error ? (
          <InlineAlert tone="error">
            Unable to create the account. Check the details or sign in if it
            already exists.
          </InlineAlert>
        ) : null}
        <SignupForm
          action={createFoundingAccount}
          testId="founding-signup-form"
        />
        <footer className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <p>
            Forgot your password?{" "}
            <Link href="/recover" className="text-primary hover:underline">
              Reset it
            </Link>
          </p>
        </footer>
      </div>
    </AuthPageFrame>
  );
}
