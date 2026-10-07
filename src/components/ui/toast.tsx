"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "neutral" | "success" | "error";
type ToastItem = { id: number; message: ReactNode; tone: ToastTone };

const ToastContext = createContext<{ toast: (message: ReactNode, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: ReactNode, tone: ToastTone = "neutral") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-md animate-[rise_300ms_var(--ease-form)_both] items-center gap-2.5 rounded-[10px] bg-ink px-4 py-3 text-[15px] text-paper shadow-[var(--shadow-lift)]",
            )}
          >
            {item.tone === "success" ? (
              <Check aria-hidden className="size-4 text-signal" />
            ) : item.tone === "error" ? (
              <TriangleAlert aria-hidden className="size-4 text-[#ff8f7f]" />
            ) : (
              <Info aria-hidden className="size-4 text-night-muted" />
            )}
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context.toast;
}
