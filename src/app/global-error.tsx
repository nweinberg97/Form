"use client";

/** Last-resort boundary when the root layout itself fails. Keeps to plain HTML. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          background: "#111111",
          color: "#F4F2ED",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <main style={{ padding: "48px 24px", maxWidth: 560 }}>
          <p style={{ fontWeight: 900, letterSpacing: "-0.06em", fontSize: 24, margin: 0 }}>
            FORM<span style={{ display: "inline-block", width: 13, height: 4, background: "#FF4D2E", marginLeft: 2 }} />
          </p>
          <h1 style={{ fontWeight: 900, letterSpacing: "-0.04em", fontSize: 40, lineHeight: 1, margin: "40px 0 0" }}>
            Something went wrong. Nothing you&rsquo;ve done is lost.
          </h1>
          <p style={{ color: "#A8A399", lineHeight: 1.5, margin: "16px 0 0" }}>
            FORM couldn&rsquo;t load this page. Anything you finished was already saved.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              height: 52,
              padding: "0 24px",
              border: 0,
              borderRadius: 10,
              background: "#FF4D2E",
              color: "#111111",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
