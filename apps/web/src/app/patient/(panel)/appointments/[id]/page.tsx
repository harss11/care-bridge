"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge, whenText } from "@/components/booking/appointment-bits";
import { PayPanel } from "@/components/booking/pay-panel";
import { SlotPicker } from "@/components/booking/slot-picker";
import { TicketQR } from "@/components/booking/ticket-qr";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { RateVisit } from "@/components/reviews/rate-visit";
import { ConfirmDialog, Modal } from "@/components/modal";
import { Alert, Button, Card, LoadingBlock, PageHeader, Textarea } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { downloadQrCard } from "@/lib/qr";
import {
  describeRefundPolicy,
  directionsUrl,
  formatCheckInCode,
  formatDate,
  formatMoney,
  formatTime,
  textOrNull,
} from "@/lib/format";
import type { Appointment, PublicSlot } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function AppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: a, error, reload, setData } = useApi<Appointment>(`/appointments/${id}`);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [reason, setReason] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  async function downloadReceipt() {
    setReceiptBusy(true);
    setReceiptError(null);
    try {
      const url = URL.createObjectURL(await api.download(`/appointments/${id}/receipt`));
      // The browser's PDF viewer offers print and save. If pop-ups are blocked, download instead.
      if (!window.open(url, "_blank")) {
        const link = document.createElement("a");
        link.href = url;
        link.download = "receipt.pdf";
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setReceiptError(errorMessage(err));
    } finally {
      setReceiptBusy(false);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!a) return <LoadingBlock />;

  const h = a.hospital;
  const hasTicket = a.checkInCode !== null;

  return (
    <>
      <PageHeader
        back={{ href: "/patient/appointments", label: "My appointments" }}
        title={
          hasTicket
            ? "Your appointment"
            : a.status === "PENDING_PAYMENT"
              ? "Almost there"
              : "Appointment"
        }
        subtitle={<StatusBadge status={a.status} />}
      />

      {a.status === "PENDING_PAYMENT" && (
        <PayPanel appointment={a} onChanged={(next) => (next ? setData(next) : reload())} />
      )}

      {a.status === "EXPIRED" && (
        <Alert>
          The hold on this slot ran out before payment.{" "}
          <Link href={`/doctors/${a.doctor.id}`} className="font-medium underline">
            Pick a time again
          </Link>
        </Alert>
      )}

      {a.status === "CANCELLED" && (
        <Alert>
          Cancelled {a.cancelReason ? `(${a.cancelReason})` : ""}.{" "}
          {a.rescheduledToId ? (
            <Link
              href={`/patient/appointments/${a.rescheduledToId}`}
              className="font-medium underline"
            >
              View your new appointment
            </Link>
          ) : (
            <Link href={`/doctors/${a.doctor.id}`} className="font-medium underline">
              Book again
            </Link>
          )}
        </Alert>
      )}

      {a.rescheduledFromId && (
        <Alert tone="info">
          Rescheduled from an earlier appointment.{" "}
          <Link
            href={`/patient/appointments/${a.rescheduledFromId}`}
            className="font-medium underline"
          >
            View it
          </Link>
        </Alert>
      )}

      <Card className="space-y-5">
        {a.tokenNumber != null && a.status !== "CANCELLED" && (
          <div className="flex flex-col items-center rounded-2xl bg-brand-700 px-4 py-5 text-white">
            <div className="text-sm opacity-80">Your token number</div>
            <div
              className="text-6xl leading-none font-bold tabular-nums"
              aria-label={`Token ${a.tokenNumber}`}
            >
              {a.tokenNumber}
            </div>
            <div className="mt-2 text-sm opacity-90">{whenText(a)}</div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <DoctorAvatar doctor={a.doctor} />
          <div className="min-w-0">
            <div className="font-semibold text-slate-900">{a.doctor.name}</div>
            <div className="text-sm text-slate-600">
              {[a.department.name, a.doctor.specialization].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Patient</dt>
            <dd className="font-medium text-slate-900">{a.patient.fullName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">When</dt>
            <dd className="font-medium text-slate-900">
              {formatDate(a.appointmentDate)}, {formatTime(a.slotStart, h.timezone)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Where</dt>
            <dd className="font-medium text-slate-900">
              {h.name}
              {h.addressLine1 ? `, ${h.addressLine1}` : ""}
              {h.city ? `, ${h.city}` : ""}
            </dd>
          </div>
          {a.reasonForVisit && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Reason</dt>
              <dd className="text-slate-900">{a.reasonForVisit}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">Fee</dt>
            <dd className="font-medium text-slate-900">
              {formatMoney(a.feeAmount, a.currency)}
              {a.payment?.status === "CAPTURED" && (
                <span className="ml-2 text-emerald-700">Paid</span>
              )}
              {a.payment && a.payment.refunds.length > 0 && (
                <RefundLine payment={a.payment} currency={a.currency} />
              )}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <a
            href={directionsUrl({ ...h })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Directions
          </a>
          {h.phone && (
            <a
              href={`tel:${h.phone}`}
              className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Call hospital
            </a>
          )}
          {a.payment &&
            ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(a.payment.status) && (
              <Button
                variant="secondary"
                className="h-10"
                loading={receiptBusy}
                onClick={downloadReceipt}
              >
                Download receipt
              </Button>
            )}
        </div>
        {receiptError && <Alert>{receiptError}</Alert>}
      </Card>

      <RateVisit appointment={a} onChanged={setData} />

      {a.queueToken && a.tokenNumber != null && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Follow the queue live</h2>
            <p className="text-sm text-slate-600">
              See which token is with the doctor and your estimated wait.
            </p>
          </div>
          <Link
            href={"/q/" + a.queueToken + "?token=" + a.tokenNumber}
            className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Open live queue
          </Link>
        </Card>
      )}

      {hasTicket && a.checkInCode && (
        <Card className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-semibold text-slate-900">Show this at reception</h2>
          <TicketQR value={a.checkInCode} />
          <div className="font-mono text-xl font-bold tracking-widest text-slate-900 select-all">
            {formatCheckInCode(a.checkInCode)}
          </div>
          <p className="max-w-sm text-sm text-slate-600">
            Reception scans the QR or types this code to check you in. Please arrive about 10
            minutes early.
          </p>
          <Button
            variant="secondary"
            className="h-9 px-3"
            onClick={() =>
              void downloadQrCard(
                {
                  value: a.checkInCode!,
                  title: "Token " + a.tokenNumber + " · " + a.doctor.name,
                  caption: formatCheckInCode(a.checkInCode!),
                },
                "mediq-ticket-" + a.tokenNumber + ".png",
              ).catch((err) => setReceiptError(errorMessage(err)))
            }
          >
            Save QR as image
          </Button>
        </Card>
      )}

      {(a.canReschedule || a.canCancel) && a.status !== "PENDING_PAYMENT" && (
        <div className="flex flex-wrap gap-2">
          {a.canReschedule && (
            <Button variant="secondary" onClick={() => setRescheduling(true)}>
              Reschedule
            </Button>
          )}
          {a.canCancel && (
            <Button variant="ghost" className="text-red-700" onClick={() => setCancelling(true)}>
              Cancel appointment
            </Button>
          )}
        </div>
      )}
      {a.status === "CONFIRMED" && !a.canCancel && (
        <p className="text-sm text-slate-600">
          It&apos;s too close to the appointment to cancel or reschedule online. Please call the
          hospital.
        </p>
      )}

      <ConfirmDialog
        open={cancelling}
        title="Cancel this appointment?"
        message={
          <div className="space-y-2">
            <p>Your seat is released straight away. You can book again at any time.</p>
            {a.cancelRefund ? (
              <p className="rounded-lg bg-slate-100 p-3 font-medium text-slate-900">
                {a.cancelRefund.amount > 0
                  ? `You will be refunded ${formatMoney(a.cancelRefund.amount, a.currency)}${a.cancelRefund.percent < 100 ? ` (${a.cancelRefund.percent}% of ${formatMoney(a.feeAmount, a.currency)})` : ""}, back to your original payment method in about 5-7 days.`
                  : "No refund applies if you cancel now."}
              </p>
            ) : null}
            {a.cancelRefund && (
              <p className="text-xs text-slate-600">{describeRefundPolicy(a.refundPolicy)}</p>
            )}
          </div>
        }
        danger
        confirmLabel="Cancel appointment"
        onClose={() => setCancelling(false)}
        onConfirm={async () => {
          setData(
            await api.post<Appointment>(`/appointments/${a.id}/cancel`, {
              reason: textOrNull(reason),
            }),
          );
        }}
      >
        <Textarea
          label="Reason (optional)"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>

      <Modal open={rescheduling} title="Choose a new time" onClose={() => setRescheduling(false)}>
        {rescheduling && (
          <RescheduleForm
            appointment={a}
            onCancel={() => setRescheduling(false)}
            onDone={(next) => router.replace(`/patient/appointments/${next.id}`)}
          />
        )}
      </Modal>
    </>
  );
}

function RescheduleForm({
  appointment,
  onDone,
  onCancel,
}: {
  appointment: Appointment;
  onDone: (next: Appointment) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<{
    slot: PublicSlot & { date: string };
    timezone: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api.post<Appointment>(`/appointments/${appointment.id}/reschedule`, {
          slotId: picked.slot.id,
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        With {appointment.doctor.name}. No extra charge. You&apos;ll get a new token and QR code.
      </p>
      <SlotPicker
        doctorId={appointment.doctor.id}
        selectedId={picked?.slot.id ?? null}
        disabledStart={appointment.slotStart}
        onSelect={(slot, timezone) => setPicked({ slot, timezone })}
      />
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Keep current time
        </Button>
        <Button onClick={submit} loading={busy} disabled={!picked}>
          {picked ? `Move to ${formatTime(picked.slot.startAt, picked.timezone)}` : "Choose a slot"}
        </Button>
      </div>
    </div>
  );
}

/** "Refunded Rs.250", or what is still happening with the refund. */
function RefundLine({
  payment,
  currency,
}: {
  payment: NonNullable<Appointment["payment"]>;
  currency: string;
}) {
  const sum = (statuses: Array<"PENDING" | "PROCESSED" | "FAILED">) =>
    payment.refunds.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + r.amount, 0);
  const pending = sum(["PENDING"]);
  const done = sum(["PROCESSED"]);
  const failed = sum(["FAILED"]);
  return (
    <span className="mt-0.5 block text-sm font-normal text-slate-600">
      {done > 0 && `Refunded ${formatMoney(done, currency)}. `}
      {pending > 0 &&
        `Refund of ${formatMoney(pending, currency)} is being processed (about 5-7 days). `}
      {failed > 0 &&
        `A refund of ${formatMoney(failed, currency)} needs attention: please contact the hospital.`}
    </span>
  );
}
