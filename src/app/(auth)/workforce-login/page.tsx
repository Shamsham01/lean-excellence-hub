import Link from "next/link";

import { AuthBackLink } from "@/components/auth/auth-back-link";
import { AuthFieldLabel } from "@/components/auth/auth-field-label";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import { InlineAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function WorkforceLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthPageFrame>
      <AuthBackLink href="/login">Back to email sign in</AuthBackLink>
      <AuthPageHeader
        title="Workforce sign in"
        description="Sign in with your organisation code and workforce credentials."
      />
      <div className="mt-6 flex flex-col gap-4">
        {error ? (
          <InlineAlert tone="error">
            Unable to sign in with those credentials.
          </InlineAlert>
        ) : null}
        <form
          action="/api/auth/workforce"
          method="post"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <AuthFieldLabel htmlFor="organisationCode" required>
              Organisation code
            </AuthFieldLabel>
            <Input id="organisationCode" name="organisationCode" required />
          </div>
          <div className="flex flex-col gap-2">
            <AuthFieldLabel htmlFor="workforceAlias" required>
              Workforce ID or username
            </AuthFieldLabel>
            <Input id="workforceAlias" name="workforceAlias" required />
          </div>
          <div className="flex flex-col gap-2">
            <AuthFieldLabel htmlFor="password" required>
              Password
            </AuthFieldLabel>
            <AuthPasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <footer className="text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Email sign in
          </Link>
        </footer>
      </div>
    </AuthPageFrame>
  );
}
