import type { Metadata } from "next";

import { EarlyAccessPage } from "@/components/marketing/early-access-page";

export const metadata: Metadata = {
  title: "Get free access — Lean Excellence Hub",
  description:
    "Lean Excellence Hub is in early access. Tell us about your site and we will set up free access with you.",
};

export default function Page() {
  return <EarlyAccessPage />;
}
