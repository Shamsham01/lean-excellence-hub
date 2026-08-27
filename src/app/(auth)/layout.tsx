import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <p className="typography-product-identity">Lean Excellence Hub</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Operational excellence for manufacturing organisations
          </p>
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
