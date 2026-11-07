import type { ReactNode } from "react";

import { AuthBrandMark } from "@/components/brand/auth-brand-mark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <AuthBrandMark className="mb-8 w-full max-w-md" showStrapline />
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
