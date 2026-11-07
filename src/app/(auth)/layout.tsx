import type { ReactNode } from "react";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthSplitLayout>{children}</AuthSplitLayout>;
}
