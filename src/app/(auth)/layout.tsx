import type { ReactNode } from "react";

import { LehBrandHomeLink } from "@/components/brand/leh-brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex w-full max-w-md flex-col items-center gap-3 text-center">
          <LehBrandHomeLink />
          <p className="max-w-sm text-sm text-muted-foreground">
            Operational excellence for manufacturing organisations
          </p>
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
