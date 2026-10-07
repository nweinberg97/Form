"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatDays } from "@/lib/dates";
import { formatDosage } from "@/lib/dosage";
import { deleteTemplate, duplicateTemplate } from "@/server/actions/clinician";
import type { TemplateSummary } from "@/server/services/clinician";
import { ConfirmSheet } from "../confirm";

export function TemplateList({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState<TemplateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <li key={t.id} className="flex flex-col rounded-[14px] border border-line bg-surface">
            <div className="flex-1 px-5 pt-4 pb-3">
              <p className="kicker text-muted">
                {t.count} {t.count === 1 ? "exercise" : "exercises"} · {formatDays(t.days)} · ~{t.minutes} min
              </p>
              <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.015em]">
                <Link href={`/clinic/templates/${t.id}`} className="hover:underline">
                  {t.name}
                </Link>
              </h2>
              {t.description ? <p className="mt-1 text-sm text-muted">{t.description}</p> : null}
              <ol className="mt-3 flex flex-col gap-0.5 text-sm">
                {t.items.slice(0, 6).map((i, n) => (
                  <li key={`${i.exerciseId}-${n}`} className="flex justify-between gap-3">
                    <span className="truncate">
                      <span className="kicker mr-2 text-faint tabular">{String(n + 1).padStart(2, "0")}</span>
                      {i.name}
                    </span>
                    <span className="shrink-0 text-muted tabular">{formatDosage(i)}</span>
                  </li>
                ))}
                {t.items.length > 6 ? <li className="text-muted">+{t.items.length - 6} more</li> : null}
              </ol>
            </div>
            <div className="flex items-center gap-1 border-t border-line px-3 py-2">
              <Link
                href={`/clinic/templates/${t.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold hover:bg-sunken"
              >
                <Pencil aria-hidden className="size-4" /> Edit<span className="sr-only"> {t.name}</span>
              </Link>
              <button
                type="button"
                disabled={pending && busyId === t.id}
                onClick={() => {
                  setBusyId(t.id);
                  start(async () => {
                    const result = await duplicateTemplate({ templateId: t.id });
                    if (result.ok) {
                      toast(`Duplicated “${t.name}”`, "success");
                      router.refresh();
                    } else toast(result.error, "error");
                    setBusyId(null);
                  });
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold hover:bg-sunken disabled:opacity-50"
              >
                <Copy aria-hidden className="size-4" /> Duplicate<span className="sr-only"> {t.name}</span>
              </button>
              <span className="ml-auto kicker hidden text-faint sm:inline">Updated {t.updatedAgo}</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setDeleting(t);
                }}
                aria-label={`Delete ${t.name}`}
                title="Delete"
                className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Programs already created from it aren't affected."
        confirmLabel="Delete template"
        tone="danger"
        pending={pending}
        onConfirm={() =>
          deleting &&
          start(async () => {
            const result = await deleteTemplate({ templateId: deleting.id });
            if (result.ok) {
              toast("Template deleted", "success");
              setDeleting(null);
              router.refresh();
            } else setError(result.error);
          })
        }
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </ConfirmSheet>
    </>
  );
}
