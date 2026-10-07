import { ArrowLeftRight } from "lucide-react";
import { switchDemoView } from "@/server/actions/auth";
import { cn } from "@/lib/cn";

/**
 * Shown only inside a demo clinic. Lets the visitor flip between the
 * clinician (Marina) and patient (Jordan) views of the same live data.
 */
export function DemoBar({ role, className }: { role: "patient" | "clinician" | "admin"; className?: string }) {
  const isPatient = role === "patient";
  return (
    <div
      className={cn(
        "relative z-[var(--z-sticky)] flex items-center justify-between gap-3 bg-signal px-4 py-2 text-ink",
        className,
      )}
    >
      <p className="min-w-0 truncate text-[13px] font-medium">
        <span className="kicker mr-2 font-semibold">Demo</span>
        <span className="hidden sm:inline">
          {isPatient ? "You're Jordan, a patient." : "You're Marina Chen, PT."} Sample data — changes stay in your private
          demo.
        </span>
        <span className="sm:hidden">{isPatient ? "Viewing as Jordan" : "Viewing as Marina"}</span>
      </p>
      <form action={switchDemoView} className="shrink-0">
        <input type="hidden" name="as" value={isPatient ? "clinician" : "patient"} />
        <button
          type="submit"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[13px] font-semibold text-paper transition-colors hover:bg-ink-soft"
        >
          <ArrowLeftRight aria-hidden className="size-3.5" />
          {isPatient ? "Clinician view" : "Patient view"}
        </button>
      </form>
    </div>
  );
}
