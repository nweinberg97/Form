"use client";

import { useEffect, useState } from "react";

/**
 * Hidden `timezone` field, filled from the visitor's browser on mount so the
 * server can schedule "today" in their local time. Falls back to the server
 * default when the browser can't tell us.
 */
export function TimezoneInput({ name = "timezone" }: { name?: string }) {
  const [timeZone, setTimeZone] = useState("");
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimeZone(tz);
    } catch {
      // Older browsers: the server picks a sensible default.
    }
  }, []);
  return <input type="hidden" name={name} value={timeZone} />;
}
