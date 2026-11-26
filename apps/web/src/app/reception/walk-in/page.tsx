"use client";

import Link from "next/link";
import { useState } from "react";
import { PaymentBadge } from "@/components/desk/bits";
import { ReceptionFrame } from "@/components/desk/frame";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
} from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { addDays, formatDate, formatMoney, formatTime, textOrNull, todayIn } from "@/lib/format";
import { showPdf } from "@/lib/pdf";
import type { DeskDoctor, DeskSlot, Gender, StaffAppointment } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function WalkInPage() {
  return (
    <ReceptionFrame>
      <WalkInForm />
    </ReceptionFrame>
  );
}

interface SlotsResponse {
  timezone: string;
  date: string;
  doctor: { id: string; name: string; consultationFee: number };
  items: DeskSlot[];
}

function WalkInForm() {
  const doctors = useApi<{ items: DeskDoctor[]; timezone: string }>("/desk/doctors");
  const zone = doctors.data?.timezone ?? "Asia/Kolkata";
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [reason, setReason] = useState("");
  const [payment, setPayment] = useState<"CASH" | "PAY_LATER">("CASH");
  const [checkIn, setCheckIn] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [booked, setBooked] = useState<StaffAppointment | null>(null);
  const [slipError, setSlipError] = useState<string | null>(null);

  const today = todayIn(zone);
  const day = date || today;
  const slots = useApi<SlotsResponse>(
    doctorId ? "/desk/slots?doctorId=" + doctorId + "&date=" + day : null,
  );
  const doctor = doctors.data?.items.find((d) => d.id === doctorId);
  const fee = slots.data?.doctor.consultationFee ?? doctor?.consultationFee ?? 0;
  const open = (slots.data?.items ?? []).filter((s) => s.available);
  const chosen = open.find((s) => s.id === slotId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (!slotId) {
      setError("Choose a doctor and a time slot first.");
      return;
    }
    setBusy(true);
    try {
      const ageYears = age.trim() === "" ? null : Number(age);
      const result = await api.post<StaffAppointment>("/desk/appointments", {
        slotId,
        patient: {
          fullName: name.trim(),
          phone: textOrNull(phone),
          ageYears: ageYears !== null && Number.isFinite(ageYears) ? ageYears : null,
          gender: gender || null,
        },
        reasonForVisit: textOrNull(reason),
        payment: fee > 0 ? payment : "PAY_LATER",
        checkIn,
        sendSms: sendSms && phone.trim() !== "",
      });
      setBooked(result);
    } catch (err) {
      setError(errorMessage(err));
      const fe = fieldErrors(err);
      setErrors({
        name: fe["patient.fullName"] ?? "",
        phone: fe["patient.phone"] ?? "",
        age: fe["patient.ageYears"] ?? "",
      });
      // A slot that just filled up must disappear from the list.
      slots.reload();
      setSlotId("");
    } finally {
      setBusy(false);
    }
  }

  async function printSlip() {
    if (!booked) return;
    setSlipError(null);
    try {
      const blob = await api.download("/desk/appointments/" + booked.id + "/slip");
      const problem = showPdf(blob, "slip.pdf");
      if (problem) setSlipError(problem);
    } catch (err) {
      setSlipError(errorMessage(err));
    }
  }

  function another() {
    setBooked(null);
    setSlotId("");
    setName("");
    setPhone("");
    setAge("");
    setGender("");
    setReason("");
    setError(null);
    slots.reload();
  }

  if (booked) {
    return (
      <>
        <PageHeader title="Walk-in booked" back={{ href: "/reception", label: "Back to today" }} />
        <Card className="space-y-5">
          <div className="flex flex-col items-center rounded-2xl bg-brand-700 px-4 py-6 text-white">
            <div className="text-sm opacity-80">Token number</div>
            <div className="text-7xl leading-none font-bold tabular-nums">{booked.tokenNumber}</div>
            <div className="mt-2 text-sm opacity-90">
              {booked.doctor.name} · {formatTime(booked.slotStart, zone)}
            </div>
          </div>
          <div className="space-y-1 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">{booked.patient.fullName}</div>
            <div>{booked.department.name}</div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <PaymentBadge a={booked} />
              {booked.status === "CHECKED_IN" && <span>Checked in and waiting</span>}
            </div>
          </div>
          {!booked.paid && booked.feeAmount > 0 && (
            <Alert tone="info">
              Fee {formatMoney(booked.feeAmount, booked.currency)} is still to be collected. Use
              Record cash on the Today list when the patient pays.
            </Alert>
          )}
          {slipError && <Alert>{slipError}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={printSlip}>Print slip</Button>
            <Button variant="secondary" onClick={another}>
              Book another
            </Button>
            <Link
              href="/reception"
              className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back to today
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New walk-in"
        subtitle="Book a patient at the desk. They get the next token for the doctor."
        back={{ href: "/reception", label: "Back to today" }}
      />
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">1. Doctor and time</h2>
          {doctors.loading && !doctors.data && <LoadingBlock />}
          {doctors.error && <Alert>{doctors.error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Doctor"
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                setSlotId("");
              }}
            >
              <option value="">Choose a doctor</option>
              {(doctors.data?.items ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.department.name} · {formatMoney(d.consultationFee)}
                </option>
              ))}
            </Select>
            <Field
              label="Day"
              type="date"
              name="day"
              min={today}
              max={addDays(today, 30)}
              value={day}
              onChange={(e) => {
                setDate(e.target.value);
                setSlotId("");
              }}
            />
          </div>
          {doctorId && slots.loading && !slots.data && <LoadingBlock />}
          {slots.error && <Alert>{slots.error}</Alert>}
          {doctorId && slots.data && open.length === 0 && (
            <Alert tone="info">
              No open slots for {formatDate(day)}. Try another day, or ask the hospital admin to add
              slots.
            </Alert>
          )}
          {open.length > 0 && (
            <div
              role="radiogroup"
              aria-label="Time slots"
              className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
              {open.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  role="radio"
                  aria-checked={slotId === s.id}
                  onClick={() => setSlotId(s.id)}
                  className={
                    "rounded-xl border px-2 py-2 text-sm font-medium " +
                    (slotId === s.id
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50")
                  }
                >
                  {formatTime(s.startAt, zone)}
                  {s.remaining > 1 && (
                    <span className="block text-xs opacity-75">{s.remaining} left</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">2. Patient</h2>
          <Field
            label="Full name"
            name="name"
            autoComplete="off"
            value={name}
            error={errors.name || undefined}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Mobile (optional)"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              hint="The token is sent here by SMS."
              value={phone}
              error={errors.phone || undefined}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Field
              label="Age (optional)"
              name="age"
              inputMode="numeric"
              value={age}
              error={errors.age || undefined}
              onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            />
            <Select
              label="Gender (optional)"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | "")}
            >
              <option value="">Not stated</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <Field
            label="Reason for visit (optional)"
            name="reason"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">3. Payment and arrival</h2>
          {fee > 0 ? (
            <div role="radiogroup" aria-label="Payment" className="grid gap-2 sm:grid-cols-2">
              {PAYMENT_CHOICES.map(([value, label, hint]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
                >
                  <input
                    type="radio"
                    name="payment"
                    className="mt-0.5 accent-brand-700"
                    checked={payment === value}
                    onChange={() => setPayment(value)}
                  />
                  <span>
                    <span className="font-medium text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">
                      {value === "CASH" ? formatMoney(fee) : hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {doctorId
                ? "This doctor has no consultation fee."
                : "Choose a doctor to see the fee."}
            </p>
          )}
          <Checkbox
            label="Patient is here now: check in and add to the waiting list"
            checked={checkIn}
            onChange={setCheckIn}
          />
          {phone.trim() !== "" && (
            <Checkbox label="Send the token by SMS" checked={sendSms} onChange={setSendSms} />
          )}
        </Card>

        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy} disabled={!name.trim() || !slotId}>
            Book and issue token
          </Button>
          {chosen && doctor && (
            <span className="text-sm text-slate-600">
              {doctor.name} · {formatDate(day)} · {formatTime(chosen.startAt, zone)}
            </span>
          )}
        </div>
      </form>
    </>
  );
}

const PAYMENT_CHOICES = [
  ["CASH", "Cash received now", ""],
  ["PAY_LATER", "Collect later", "Shows as owed on the list"],
] as const;
