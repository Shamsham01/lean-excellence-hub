import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function WorkforceLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard
      title="Workforce sign in"
      description="Sign in with your organisation code and workforce credentials."
      footer={
        <Link href="/login" className="text-sm text-primary hover:underline">
          Email sign in
        </Link>
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
        action="/api/auth/workforce"
        method="post"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="organisationCode">Organisation code</Label>
          <Input id="organisationCode" name="organisationCode" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workforceAlias">Workforce ID or username</Label>
          <Input id="workforceAlias" name="workforceAlias" required />
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
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
