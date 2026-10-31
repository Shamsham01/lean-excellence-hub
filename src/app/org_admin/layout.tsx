import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default function PlatformOwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
