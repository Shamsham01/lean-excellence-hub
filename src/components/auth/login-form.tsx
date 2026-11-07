"use client";

import { AuthFieldLabel } from "@/components/auth/auth-field-label";
import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import { AuthRememberForgotRow } from "@/components/auth/auth-remember-forgot-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({
  next,
  defaultEmail,
  emailReadOnly,
}: {
  next?: string | null;
  defaultEmail?: string;
  emailReadOnly?: boolean;
}) {
  return (
    <form
      action="/api/auth/login"
      method="post"
      className="flex flex-col gap-4"
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-2">
        <AuthFieldLabel htmlFor="email" required>
          Email
        </AuthFieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          readOnly={emailReadOnly}
          required
        />
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
      <AuthRememberForgotRow />
      <Button type="submit" className="w-full">
        Email sign in
      </Button>
    </form>
  );
}
