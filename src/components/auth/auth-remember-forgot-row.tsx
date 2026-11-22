"use client";

import Link from "next/link";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function AuthRememberForgotRow({
  recoverHref = "/recover",
}: {
  recoverHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-2">
        <Checkbox id="keep-logged-in" aria-labelledby="keep-logged-in-label" />
        <Label
          id="keep-logged-in-label"
          htmlFor="keep-logged-in"
          className="cursor-pointer text-sm font-normal text-muted-foreground"
        >
          Keep me logged in
        </Label>
      </label>
      <Link
        href={recoverHref}
        className="text-sm font-medium text-primary hover:underline"
      >
        Forgot password?
      </Link>
    </div>
  );
}
