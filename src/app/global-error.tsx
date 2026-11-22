"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#090e17",
          color: "#f1f5f9",
        }}
      >
        <div
          data-testid="workspace-load-error"
          style={{
            maxWidth: 512,
            margin: "0 auto",
            padding: "64px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Root error replaces the document shell, so the dark icon is a static file. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            height={32}
            src="/brand/leh-icon-dark-128.png"
            width={32}
          />
          <h1 style={{ fontSize: 28, margin: 0 }}>
            This workspace couldn’t load
          </h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            The page failed to reload. Your previous action may already have
            been saved. Reload before repeating it.
          </p>
          {error.digest ? (
            <p
              data-testid="error-digest"
              style={{ margin: 0, color: "#94a3b8" }}
            >
              Reference {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: 44,
                padding: "8px 16px",
                borderRadius: 8,
                border: 0,
                background: "#465fff",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  reset();
                }
              }}
              style={{
                minHeight: 44,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #1e2d42",
                background: "transparent",
                color: "#f1f5f9",
                fontWeight: 600,
              }}
            >
              Go back
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
