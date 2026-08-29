"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvitationLifecycleView } from "@/modules/identity/invitation-lifecycle";

import { createInvitationAccount } from "@/app/invitations/[token]/activate/actions";

export function InvitationActivateForm({
  token,
  lifecycle,
  loginPath,
}: {
  token: string;
  lifecycle: InvitationLifecycleView;
  loginPath: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("token", token);
    formData.set("password", password);
    formData.set("confirmPassword", confirmPassword);

    const result = await createInvitationAccount(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthCard
        title="Confirm your email"
        description="We sent a confirmation email to finish creating your account."
      >
        <p className="text-sm text-muted-foreground">
          Open the confirmation link, then you will return to this invitation to
          accept it.
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link href={`/invitations/${token}`}>Back to invitation</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description={
        lifecycle.organisationName
          ? `Join ${lifecycle.organisationName} on Lean Excellence Hub.`
          : "Create your Lean Excellence Hub account."
      }
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={loginPath} className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      }
    >
      <dl className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Invitation for</dt>
          <dd className="font-medium text-foreground">
            {lifecycle.recipientEmail}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use at least 12 characters with upper and lower case letters, a
            number, and a symbol.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account and continue"}
        </Button>
      </form>
    </AuthCard>
  );
}
