"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { Modal } from "@/components/modal";
import { ProfileForm, RELATION_LABEL } from "@/components/patient/profile-form";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Textarea,
  cx,
} from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import {
  describeRefundPolicy,
  formatDate,
  formatMoney,
  formatTime,
  textOrNull,
} from "@/lib/format";
import type { Appointment, PatientProfile, SlotDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/**
 * Booking step: who is the appointment for? Continuing holds the slot for the
 * patient (5 minutes) and moves on to payment on the appointment page.
 */
export default function BookPage() {
  const { slotId } = useParams<{ slotId: string }>();
  const router = useRouter();
  const detail = useApi<SlotDetail>(`/public/slots/${slotId}`);
  const profiles = useApi<{ items: PatientProfile[] }>("/patient/profiles");
  const [chosen, setChosen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);

  if (detail.error) {
    return (
      <EmptyState title="This slot is no longer available">
        <Link href="/hospitals" className="font-medium text-brand-700 underline">
          Choose another time
        </Link>
      </EmptyState>
    );
  }
  if (!detail.data || !profiles.data) return <LoadingBlock />;

  const { slot, doctor } = detail.data;
  const hospital = doctor.hospital;
  const people = profiles.data.items;
  // Default to the patient themselves.
  const profileId =
    chosen ?? people.find((p) => p.relation === "SELF")?.id ?? people[0]?.id ?? null;

  async function lock() {
    if (!profileId) return;
    setBusy(true);
    setError(null);
    try {
      const appointment = await api.post<Appointment>("/appointments/lock", {
        slotId,
        patientProfileId: profileId,
        reasonForVisit: textOrNull(reason),
      });
      router.replace(`/patient/appointments/${appointment.id}`);
    } catch (err) {
      setError({ message: errorMessage(err), code: err instanceof ApiError ? err.code : "" });
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Confirm your booking"
        back={{ href: `/doctors/${doctor.id}`, label: doctor.name }}
      />

      <Card className="flex items-center gap-4">
        <DoctorAvatar doctor={doctor} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{doctor.name}</div>
          <div className="text-sm text-slate-600">
            {doctor.department.name} · {hospital.name}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {formatDate(slot.date)} · {formatTime(slot.startAt, hospital.timezone)}
          </div>
        </div>
        <div className="text-right font-bold text-slate-900">
          {formatMoney(doctor.consultationFee, hospital.currency)}
        </div>
      </Card>

      <section className="space-y-3" aria-labelledby="who-heading">
        <div className="flex items-center justify-between">
          <h2 id="who-heading" className="font-semibold text-slate-900">
            Who is this appointment for?
          </h2>
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            + Add someone
          </button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="who-heading">
          {people.map((p) => (
            <li key={p.id}>
              <button
                role="radio"
                aria-checked={profileId === p.id}
                onClick={() => setChosen(p.id)}
                className={cx(
                  "w-full rounded-xl border p-4 text-left",
                  profileId === p.id
                    ? "border-brand-700 bg-brand-50 ring-1 ring-brand-700"
                    : "border-slate-300 bg-white hover:border-brand-400",
                )}
              >
                <div className="font-medium text-slate-900">{p.fullName}</div>
                <div className="text-sm text-slate-600">{RELATION_LABEL[p.relation]}</div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Textarea
        label="Reason for visit (optional)"
        name="reason"
        maxLength={300}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="Shared with the doctor. Don't include sensitive details you wouldn't tell reception."
      />

      {error && (
        <Alert>
          {error.message}{" "}
          {error.code === "SLOT_FULL" || error.code === "SLOT_UNAVAILABLE" ? (
            <Link href={`/doctors/${doctor.id}`} className="font-medium underline">
              Pick another time
            </Link>
          ) : error.code === "TOO_MANY_HOLDS" || error.code === "ALREADY_BOOKED" ? (
            <Link href="/patient/appointments" className="font-medium underline">
              See my appointments
            </Link>
          ) : null}
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button onClick={lock} loading={busy} disabled={!profileId || !slot.available}>
          Continue to payment
        </Button>
      </div>
      {doctor.consultationFee > 0 && (
        <p className="text-center text-xs text-slate-600 sm:text-right">
          <strong className="font-semibold">Cancellation:</strong>{" "}
          {describeRefundPolicy({
            fullRefundHours: hospital.refundFullHours,
            partialPercent: hospital.refundPartialPercent,
          })}
        </p>
      )}
      <p className="text-center text-xs text-slate-500 sm:text-right">
        We hold your slot for 5 minutes while you pay. By booking you agree to the{" "}
        <Link href="/terms" className="underline" target="_blank">
          Terms
        </Link>
        .
      </p>

      <Modal open={adding} title="Add someone" onClose={() => setAdding(false)}>
        {adding && (
          <ProfileForm
            onCancel={() => setAdding(false)}
            onSaved={(p) => {
              setAdding(false);
              setChosen(p.id);
              profiles.reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}
