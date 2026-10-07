"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { addClinicianNote } from "@/server/actions/clinician";

type Note = { id: string; body: string; ago: string; authorName: string };

export function ClinicianNotes({ patientId, firstName, notes }: { patientId: string; firstName: string; notes: Note[] }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section aria-labelledby="notes-title" className="flex flex-col gap-5">
      <div>
        <h2 id="notes-title" className="text-[15px] font-semibold">
          Clinical notes
        </h2>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
          <Lock aria-hidden className="size-3.5" />
          Only visible to your clinic. {firstName} never sees these.
        </p>
      </div>
      <form
        className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return setError("Write a note first.");
          setError(null);
          start(async () => {
            const result = await addClinicianNote({ patientId, body: body.trim() });
            if (result.ok) {
              setBody("");
              toast("Note saved", "success");
              router.refresh();
            } else setError(result.error);
          });
        }}
      >
        <label htmlFor="note-body" className="sr-only">
          New note about {firstName}
        </label>
        <Textarea
          id="note-body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          placeholder="Assessment findings, plan, anything the team should know…"
          maxLength={4000}
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="dark" loading={pending}>
            Save note
          </Button>
        </div>
      </form>
      {notes.length === 0 ? (
        <EmptyState title="No notes yet" description="Notes are timestamped and signed with your name." />
      ) : (
        <ol className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-[14px] border border-line bg-surface px-5 py-4">
              <p className="kicker text-muted">
                {note.authorName} · {note.ago}
              </p>
              <p className="mt-2 max-w-prose text-[15px] leading-relaxed whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
