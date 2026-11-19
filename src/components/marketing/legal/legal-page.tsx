import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MarketingContainer } from "../primitives";
import { MarketingShell } from "../shell";

import "./legal.css";

/** Renders a LAUNCH legal draft with a visible "Draft for review" marker. */
export function LegalPage({ markdown }: { markdown: string }) {
  return (
    <MarketingShell>
      <article className="legal-page">
        <MarketingContainer className="legal-container">
          <p className="legal-draft" role="note">
            <span className="legal-draft-badge">Draft for review</span>
            <span>
              This page is a draft and is not yet in force. Items marked
              PLACEHOLDER or CONFIRM are still to be completed.
            </span>
          </p>
          <div className="legal-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) =>
                  href?.startsWith("/") ? (
                    <Link href={href}>{children}</Link>
                  ) : (
                    <a href={href} rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                table: ({ children }) => (
                  <div className="legal-table" tabIndex={0}>
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </MarketingContainer>
      </article>
    </MarketingShell>
  );
}
