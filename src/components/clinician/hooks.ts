"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

/** "/" focuses the given input (unless the user is already typing somewhere). */
export function useSlashFocus(ref: RefObject<HTMLInputElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const numeric = target?.tagName === "INPUT" && target.getAttribute("inputmode") === "numeric";
      if (target && !numeric && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref, enabled]);
}

/** A stable random id per mount, for idempotent message sends. */
export function newClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Calls fn once on mount (strict-mode safe). */
export function useOnce(fn: () => void) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without async clipboard permission.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Media query as state. Server snapshot assumes desktop (the clinician product is desktop-first). */
export function useMediaQuery(query: string, serverValue = true) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
