import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createFoundingAccount } from "./actions";

export default async function FoundingSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;

  if (status === "check-email") {
    return (
      <AuthCard
        title="Check your email"
        description="Confirm your address to finish creating your organisation account. Workforce accounts still require an invitation."
      >
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your organisation"
      description="This creates a founder account. Joining an existing organisation still requires an invitation."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        action={createFoundingAccount}
        className="flex flex-col gap-4"
        data-testid="founding-signup-form"
      >
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            Unable to create the account. Check the details or sign in if it
            already exists.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
