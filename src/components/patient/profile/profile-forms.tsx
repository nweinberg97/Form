"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateNotificationPrefs, updatePatientProfile } from "@/server/actions/patient";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Toggle } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

function timeZones(current: string) {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export function AccountForm({ name, email, timezone }: { name: string; email: string; timezone: string }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [tz, setTz] = useState(timezone);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => timeZones(timezone), [timezone]);
  const dirty = value.trim() !== name || tz !== timezone;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await updatePatientProfile({ name: value.trim(), timezone: tz }).catch(() => null);
    setBusy(false);
    if (!res) {
      toast("We couldn't reach FORM. Nothing was changed — try again.", "error");
      return;
    }
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast("Saved.", "success");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <Field label="Name" htmlFor="profile-name" error={error}>
        <Input
          id="profile-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="name"
          maxLength={80}
          aria-invalid={error ? true : undefined}
          required
        />
      </Field>
      <Field label="Email" htmlFor="profile-email" hint="To change your email, ask your clinic.">
        <Input id="profile-email" value={email} readOnly aria-readonly className="bg-sunken text-muted" />
      </Field>
      <Field label="Time zone" htmlFor="profile-tz" hint="Your day — and what counts as today's session — follows this.">
        <Select id="profile-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <Button type="submit" variant="dark" size="lg" loading={busy} disabled={!dirty || !value.trim()}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function NotificationForm({
  notifyReminders,
  notifyMessages,
  reminderTime,
}: {
  notifyReminders: boolean;
  notifyMessages: boolean;
  reminderTime: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [prefs, setPrefs] = useState({ notifyReminders, notifyMessages, reminderTime });
  const [busy, setBusy] = useState(false);

  const save = async (next: typeof prefs) => {
    const previous = prefs;
    setPrefs(next);
    setBusy(true);
    const res = await updateNotificationPrefs(next).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setPrefs(previous);
      toast(res && !res.ok ? res.error : "We couldn't save that. Try again in a moment.", "error");
      return;
    }
    toast("Notification settings saved.", "success");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <Toggle
        label="Daily reminder"
        description="A gentle nudge on days you have a session: “Your rehabilitation is ready.”"
        checked={prefs.notifyReminders}
        disabled={busy}
        onChange={(v) => save({ ...prefs, notifyReminders: v })}
      />
      {prefs.notifyReminders ? (
        <Field label="Reminder time" htmlFor="reminder-time">
          <Input
            id="reminder-time"
            type="time"
            value={prefs.reminderTime}
            onChange={(e) => setPrefs({ ...prefs, reminderTime: e.target.value })}
            onBlur={(e) => {
              if (/^\d{2}:\d{2}$/.test(e.target.value) && e.target.value !== reminderTime) save({ ...prefs, reminderTime: e.target.value });
            }}
            className="max-w-40"
          />
        </Field>
      ) : null}
      <Toggle
        label="New messages"
        description="When your care team replies to you."
        checked={prefs.notifyMessages}
        disabled={busy}
        onChange={(v) => save({ ...prefs, notifyMessages: v })}
      />
    </div>
  );
}
