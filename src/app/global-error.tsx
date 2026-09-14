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
          background: "#0b0f14",
          color: "#e8eef4",
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
          <h1 style={{ fontSize: 28, margin: 0 }}>
            This workspace couldn’t load
          </h1>
          <p style={{ margin: 0, color: "#9aa8b5" }}>
            Reload to try again, or go back. Your data was not changed by this
            page error.
          </p>
          {error.digest ? (
            <p
              data-testid="error-digest"
              style={{ margin: 0, color: "#9aa8b5" }}
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
                background: "#e8eef4",
                color: "#0b0f14",
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
                border: "1px solid #3a4652",
                background: "transparent",
                color: "#e8eef4",
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
