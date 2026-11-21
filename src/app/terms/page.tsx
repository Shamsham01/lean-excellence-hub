import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal/legal-page";
import { TERMS_MARKDOWN } from "@/content/legal/terms";

export const metadata: Metadata = {
  title: "Terms (draft for review) — Lean Excellence Hub",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return <LegalPage markdown={TERMS_MARKDOWN} />;
}
