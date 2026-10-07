"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function stamp(date: Date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Builds an RFC 5545 event at a floating local time (8:00 wherever the patient is). */
export function buildIcs({ date, minutes, description }: { date: string; minutes: number; description: string }) {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(y, m - 1, d, 8, 0, 0);
  const end = new Date(start.getTime() + Math.max(5, minutes) * 60_000);
  const local = (dt: Date) =>
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const uid = `${date}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}@form`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FORM//Rehabilitation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `SUMMARY:${escapeText("FORM — Today's rehabilitation")}`,
    `DESCRIPTION:${escapeText(description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText("Your rehabilitation is ready.")}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function AddToCalendar({
  date,
  label,
  count,
  minutes,
}: {
  date: string;
  label: string;
  count: number;
  minutes: number;
}) {
  const toast = useToast();
  const download = () => {
    try {
      const ics = buildIcs({
        date,
        minutes,
        description: `${count} exercise${count === 1 ? "" : "s"} · about ${minutes} min. Open FORM to start.`,
      });
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `form-session-${date}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Calendar event for ${label} downloaded.`, "success");
    } catch {
      toast("We couldn't create the calendar file on this device.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="secondary" size="lg" block onClick={download} icon={<CalendarPlus aria-hidden className="size-5" />}>
        Add next session to calendar
      </Button>
      <p className="text-center text-[13px] text-muted tabular">
        {label} at 8:00 · {count} exercise{count === 1 ? "" : "s"}, about {minutes} min
      </p>
    </div>
  );
}
