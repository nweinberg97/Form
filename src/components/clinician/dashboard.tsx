"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { resolveAllAttention } from "@/server/actions/clinician";
import { ATTENTION_LABEL, ATTENTION_TONE, asKind, sortSignals } from "./attention";

type Item = { id: string; kind: string; message: string; createdAt: Date; ago: string; exerciseName: string | null };
export type AttentionGroup = { patientId: string; patientName: string; items: Item[] };

export function AttentionList({ groups }: { groups: AttentionGroup[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = groups.filter((g) => !hidden.has(g.patientId));

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-5 py-6">
        <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-sunken">
          <Check className="size-4" />
        </span>
        <div>
          <p className="font-semibold tracking-[-0.01em]">No one needs you right now.</p>
          <p className="text-sm text-muted">New pain reports, repeated Hard ratings, notes and missed sessions will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
      {visible.map((group) => (
        <AttentionRow key={group.patientId} group={group} onResolved={() => setHidden((s) => new Set(s).add(group.patientId))} />
      ))}
    </ul>
  );
}

function AttentionRow({ group, onResolved }: { group: AttentionGroup; onResolved: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const signals = sortSignals(group.items);
  const [head, ...rest] = signals;
  const kind = asKind(head.kind);
  const isPain = kind === "pain";

  return (
    <li className="group relative flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-sunken/50 sm:flex-row sm:items-start">
      <div
        aria-hidden
        className={cn("absolute top-4 bottom-4 left-0 w-[3px] rounded-r-full", isPain ? "bg-danger" : "bg-line-strong")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/clinic/patients/${group.patientId}`}
            className="text-[15px] font-semibold tracking-[-0.01em] after:absolute after:inset-0 after:content-[''] hover:underline"
          >
            {group.patientName}
          </Link>
          <Badge tone={ATTENTION_TONE[kind]}>{ATTENTION_LABEL[kind]}</Badge>
          <span className="kicker text-muted">{head.ago}</span>
        </div>
        <p className={cn("mt-1 text-[15px]", isPain ? "font-medium text-danger" : "text-ink")}>{head.message}</p>
        {rest.length ? (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {rest.map((item) => (
              <li key={item.id} className="text-sm text-muted">
                <span className="sr-only">{ATTENTION_LABEL[asKind(item.kind)]}: </span>
                {item.message} <span className="text-faint">· {item.ago}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="relative z-[1] flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await resolveAllAttention({ patientId: group.patientId });
              if (result.ok) {
                onResolved();
                toast(`Marked ${group.patientName.split(" ")[0]} as reviewed`, "success");
                router.refresh();
              } else toast(result.error, "error");
            })
          }
        >
          Mark reviewed
        </Button>
        <ArrowRight aria-hidden className="hidden size-4 text-muted sm:block" />
      </div>
    </li>
  );
}

export function UnreadThreads({ threads }: { threads: { id: string; name: string; unreadMessages: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {threads.map((t) => (
        <li key={t.id}>
          <Link
            href={`/clinic/patients/${t.id}?tab=messages`}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm transition-colors hover:border-ink"
          >
            <MessageSquare aria-hidden className="size-4 text-muted" />
            <span className="font-semibold">{t.name}</span>
            <span className="tabular text-muted">
              {t.unreadMessages} new
              <span className="sr-only"> {t.unreadMessages === 1 ? "message" : "messages"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
