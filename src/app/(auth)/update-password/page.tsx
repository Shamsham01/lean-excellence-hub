import { updatePassword } from "./actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard title="Set a new password" description="Choose a strong password for your account.">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          The password could not be updated.
        </p>
      ) : null}
      <form action={updatePassword} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>
        <Button type="submit" className="w-full">Update password</Button>
      </form>
    </AuthCard>
  );
}
