import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useLocation } from "./router";
import { resetDemo } from "./actions-auth";

/**
 * A quiet "Reset demo" control on the demo chooser page only, so the
 * product screens stay exactly as they'd look in the real app.
 */
export function DemoChrome() {
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  if (pathname !== "/demo") return null;
  return (
    <div className="flex justify-center px-4 pt-2 pb-12">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm("Start over with fresh sample data? Anything you changed in this demo will be cleared.")) return;
          setBusy(true);
          await resetDemo();
        }}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-paper px-3 text-sm font-medium text-ink hover:bg-white disabled:opacity-50"
      >
        <RotateCcw aria-hidden className="size-4" />
        {busy ? "Resetting…" : "Reset demo data"}
      </button>
    </div>
  );
}
