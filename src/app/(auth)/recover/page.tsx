import Link from "next/link";

import { requestRecovery } from "./actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthStatus } from "@/components/auth/auth-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_COPY } from "@/modules/identity/auth-copy";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const expired = error === "expired";
  const requested = sent === "true";

  return (
    <AuthCard
      title="Recover access"
      description={AUTH_COPY.recoverDescription}
      footer={
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {requested ? (
        <AuthStatus testId="recover-sent" tone="info">
          {AUTH_COPY.recoverSent}
        </AuthStatus>
      ) : (
        <form action={requestRecovery} className="flex flex-col gap-4">
          {expired ? (
            <AuthStatus testId="recover-expired" tone="danger">
              {AUTH_COPY.recoverExpired}
            </AuthStatus>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" className="w-full">
            {expired ? "Request another recovery email" : "Send recovery email"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
