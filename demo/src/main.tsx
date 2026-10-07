import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../../src/components/ui/toast";
import { Router } from "./router";
import { notFound, rootError, routes } from "./routes";
import { countRows, migrateDemoDatabase } from "./db";
import { syncExerciseLibrary } from "../../src/server/seed/library";
import { db } from "./db";
import { loadFonts } from "./fonts";
import { DemoChrome } from "./chrome";
import "./demo.css";

(globalThis as { __FORM_BASE__?: string }).__FORM_BASE__ = import.meta.env.BASE_URL;
(globalThis as { __FORM_STATIC__?: boolean }).__FORM_STATIC__ = true;
loadFonts();

const LIBRARY_VERSION = "2";

async function boot() {
  await migrateDemoDatabase();
  const stale = localStorage.getItem("form:library") !== LIBRARY_VERSION || (await countRows("exercises")) === 0;
  if (stale) {
    await syncExerciseLibrary(db);
    localStorage.setItem("form:library", LIBRARY_VERSION);
  }
}

function App() {
  const [status, setStatus] = useState<"booting" | "ready" | "failed">("booting");
  useEffect(() => {
    boot()
      .then(() => setStatus("ready"))
      .catch((error) => {
        console.error(error);
        setStatus("failed");
      });
  }, []);

  if (status !== "ready") {
    return (
      <main className="flex min-h-dvh flex-col items-start justify-end bg-ink p-8 text-paper form-grid">
        <p className="text-[length:var(--text-headline)] leading-[0.95] font-black tracking-[-0.04em]">
          FORM<span className="ml-1 inline-block h-[0.12em] w-[0.5em] bg-signal" aria-hidden />
        </p>
        <p role="status" className="mt-4 text-night-muted">
          {status === "booting"
            ? "Getting the demo ready in your browser…"
            : "This browser couldn't start the demo. Try a recent Chrome, Safari, Edge or Firefox — or turn off private browsing."}
        </p>
      </main>
    );
  }
  return (
    <ToastProvider>
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <Router routes={routes} notFound={notFound} error={rootError} />
      <DemoChrome />
    </ToastProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
