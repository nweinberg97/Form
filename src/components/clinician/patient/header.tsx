"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveX, MessageSquare, Pencil, ListPlus, RotateCcw, UserMinus, UserPlus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { assignClinician, dischargePatient, endProgram, reactivatePatient } from "@/server/actions/clinician";
import { OverflowMenu, type MenuItem } from "../menu";
import { ConfirmSheet } from "../confirm";

type Props = {
  patient: { id: string; name: string; firstName: string; email: string | null; invitePending: boolean; discharged: boolean; since: string };
  programs: { id: string; title: string }[];
  team: { id: string; name: string; credentials: string | null }[];
  clinicians: { id: string; name: string; credentials: string | null; role: string }[];
};

type Dialog = null | "share" | "discharge" | "reactivate" | { endProgram: string };

export function PatientHeader({ patient, programs, team, clinicians }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, start] = useTransition();
  const [shareWith, setShareWith] = useState("");
  const [error, setError] = useState<string | null>(null);

  const candidates = clinicians.filter((c) => !team.some((t) => t.id === c.id));
  const primary = programs[0];
  const close = () => {
    setDialog(null);
    setError(null);
  };

  const items: MenuItem[] = [
    { label: "Message", icon: <MessageSquare aria-hidden className="size-4" />, onSelect: () => router.push(`/clinic/patients/${patient.id}?tab=messages`) },
    {
      label: "Share with clinician",
      icon: <UserPlus aria-hidden className="size-4" />,
      onSelect: () => {
        setShareWith(candidates[0]?.id ?? "");
        setDialog("share");
      },
    },
    ...programs.map<MenuItem>((p) => ({
      label: programs.length > 1 ? `End “${p.title}”` : "End program",
      icon: <ArchiveX aria-hidden className="size-4" />,
      onSelect: () => setDialog({ endProgram: p.id }),
    })),
    patient.discharged
      ? { label: "Reactivate", icon: <RotateCcw aria-hidden className="size-4" />, onSelect: () => setDialog("reactivate") }
      : { label: "Discharge", icon: <UserMinus aria-hidden className="size-4" />, tone: "danger", onSelect: () => setDialog("discharge") },
  ];

  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast(success, "success");
        close();
        router.refresh();
      } else setError(result.error);
    });

  const endingId = dialog && typeof dialog === "object" ? dialog.endProgram : null;
  const ending = programs.find((p) => p.id === endingId);

  return (
    <>
      <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="kicker mb-2 text-muted">
            Patient since {patient.since}
            {team.length ? <> · {team.map((t) => t.name.split(" ")[0]).join(", ")}</> : null}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] leading-[1.02] font-black tracking-[-0.045em] sm:text-[38px]">{patient.name}</h1>
            {patient.discharged ? <Badge tone="outline">Discharged</Badge> : null}
            {patient.invitePending ? <Badge tone="outline">Invite pending</Badge> : null}
          </div>
          <p className="mt-1.5 text-[15px] text-muted">
            {programs.length ? programs.map((p) => p.title).join(" · ") : "No program yet"}
            {patient.email ? <span className="text-faint"> · {patient.email}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!patient.discharged ? (
            primary ? (
              <ButtonLink
                href={`/clinic/patients/${patient.id}/program?programId=${primary.id}`}
                icon={<Pencil aria-hidden className="size-4" />}
              >
                Edit program
              </ButtonLink>
            ) : (
              <ButtonLink href={`/clinic/patients/${patient.id}/program`} icon={<ListPlus aria-hidden className="size-4" />}>
                Build program
              </ButtonLink>
            )
          ) : null}
          <OverflowMenu label={`More actions for ${patient.name}`} items={items} />
        </div>
      </header>

      <ConfirmSheet
        open={dialog === "share"}
        onClose={close}
        title={`Share ${patient.firstName} with a clinician`}
        description="They'll see this patient's program, feedback and messages."
        confirmLabel="Share"
        pending={pending}
        onConfirm={() => {
          if (!shareWith) return close();
          act(() => assignClinician({ patientId: patient.id, clinicianId: shareWith }), "Shared");
        }}
      >
        {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
        {candidates.length ? (
          <Field label="Clinician" htmlFor="share-with">
            <Select id="share-with" value={shareWith} onChange={(e) => setShareWith(e.target.value)}>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.credentials ? `, ${c.credentials}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-[15px] text-muted">Everyone in your clinic already cares for {patient.firstName}. Add clinicians in Settings.</p>
        )}
      </ConfirmSheet>

      <ConfirmSheet
        open={Boolean(ending)}
        onClose={close}
        title={`End “${ending?.title ?? ""}”?`}
        description={`${patient.firstName} won't see these exercises from today. History stays.`}
        confirmLabel="End program"
        tone="danger"
        pending={pending}
        onConfirm={() => ending && act(() => endProgram({ patientId: patient.id, programId: ending.id }), "Program ended")}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </ConfirmSheet>

      <ConfirmSheet
        open={dialog === "discharge"}
        onClose={close}
        title={`Discharge ${patient.firstName}?`}
        description="Active programs end today and open attention items are closed. All history is kept, and you can reactivate later."
        confirmLabel="Discharge"
        tone="danger"
        pending={pending}
        onConfirm={() => act(() => dischargePatient({ patientId: patient.id }), `${patient.firstName} discharged`)}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </ConfirmSheet>

      <ConfirmSheet
        open={dialog === "reactivate"}
        onClose={close}
        title={`Reactivate ${patient.firstName}?`}
        description="They'll be back in your patient list. Build a new program to give them exercises."
        confirmLabel="Reactivate"
        pending={pending}
        onConfirm={() => act(() => reactivatePatient({ patientId: patient.id }), `${patient.firstName} reactivated`)}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </ConfirmSheet>
    </>
  );
}
