import { AuthBrandMark } from "@/components/brand/auth-brand-mark";

import { AuthGridPattern } from "./auth-grid-pattern";

export function AuthBrandPanel() {
  return (
    <aside
      className="relative flex w-full min-w-0 flex-col items-center justify-center bg-[#090e17] px-6 py-12 text-center lg:min-h-dvh lg:w-1/2 lg:px-12"
      data-testid="auth-brand-panel"
    >
      <AuthGridPattern />
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-4">
        <AuthBrandMark className="w-full" />
        <p className="text-sm text-white/70">
          One connected system for continuous improvement — evidence, action,
          and measurable value.
        </p>
      </div>
    </aside>
  );
}
