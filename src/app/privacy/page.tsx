import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal/legal-page";
import { PRIVACY_MARKDOWN } from "@/content/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy (draft for review) — Lean Excellence Hub",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return <LegalPage markdown={PRIVACY_MARKDOWN} />;
}
