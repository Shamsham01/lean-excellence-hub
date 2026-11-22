import { InlineAlert } from "@/components/ui/alert";
import type { Metadata } from "next";

import { LehBrand } from "@/components/brand/leh-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enforcePlatformLoginEntry } from "@/modules/platform-admin/console-route";
import { resolvePlatformOperator } from "@/modules/platform-admin/gate";

export const metadata: Metadata = {
  title: "Sign in",
};

const ERROR_COPY: Record<string, string> = {
  invalid: "Those credentials were not accepted.",
  limited: "Try again later.",
};

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const operator = await resolvePlatformOperator();
  enforcePlatformLoginEntry(operator.decision);
  const { error } = await searchParams;
  const message = error ? ERROR_COPY[error] : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="leh-brand-auth-shell flex flex-col items-start gap-4">
        <LehBrand lockupRasterOnly variant="full" />
        <h1 className="text-2xl font-semibold">Sign in</h1>
      </div>
      {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
      <form
        action="/api/org-admin/login"
        className="flex flex-col gap-4"
        method="post"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="platform-email">Email</Label>
          <Input
            autoComplete="username"
            id="platform-email"
            name="email"
            required
            type="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="platform-password">Password</Label>
          <Input
            autoComplete="current-password"
            id="platform-password"
            name="password"
            required
            type="password"
          />
        </div>
        <Button type="submit">Sign in</Button>
      </form>
    </div>
  );
}
