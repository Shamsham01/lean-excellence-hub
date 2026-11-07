"use client";

import { AuthFieldLabel } from "@/components/auth/auth-field-label";
import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignupForm({
  action,
  testId,
}: {
  action: (formData: FormData) => Promise<void>;
  testId?: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4" data-testid={testId}>
      <div className="flex flex-col gap-2">
        <AuthFieldLabel htmlFor="email" required>
          Email
        </AuthFieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
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
          autoComplete="new-password"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <AuthFieldLabel htmlFor="confirmPassword" required>
          Confirm password
        </AuthFieldLabel>
        <AuthPasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Create account
      </Button>
    </form>
  );
}
