"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/modal";
import {
  METHOD_LABEL,
  PaymentsTable,
  StateBadge,
  UsageCard,
  endText,
  limitText,
  priceText,
} from "@/components/subscription/bits";
import {
  Alert,
  Button,
  Card,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { textOrNull, toMinor, todayIn } from "@/lib/format";
import type {
  AdminPlan,
  HospitalDetail,
  SubscriptionPaymentMethod,
  SubscriptionView,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Change = "suspend" | "resume" | "cancel";
type Start = "period" | "trial" | "open";

/** One hospital's plan: assign or change it, record a payment received offline, suspend or resume. */
export default function HospitalSubscriptionAdminPage() {
  const { hospitalId } = useParams<{ hospitalId: string }>();
  const hospital = useApi<HospitalDetail>(`/admin/hospitals/${hospitalId}`);
  const sub = useApi<SubscriptionView>(`/admin/subscriptions/${hospitalId}`);
  const plans = useApi<{ items: AdminPlan[] }>("/admin/plans");

  if (sub.error) return <Alert>{sub.error}</Alert>;
  if (!sub.data || !plans.data || !hospital.data) return <LoadingBlock />;
  const view = sub.data;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/subscriptions", label: "Subscriptions" }}
        title={hospital.data.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StateBadge state={view.state} />
            <span>
              {view.plan ? `${view.plan.name} · ${priceText(view.plan)}` : "No plan: no limits"}
            </span>
          </span>
        }
      />

      {view.plan && (
        <Card className="space-y-3 p-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">
                {view.status === "TRIALING" ? "Trial ends" : "Paid until"}
              </dt>
              <dd className="font-medium text-slate-900">{endText(view)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Taking online bookings</dt>
              <dd className="font-medium text-slate-900">
                {view.acceptingBookings ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Limits</dt>
              <dd className="font-medium text-slate-900">
                {limitText(view.plan.maxDoctors)} doctors ·{" "}
                {limitText(view.plan.maxStaff).toLowerCase()} staff ·{" "}
                {limitText(view.plan.maxMonthlyBookings).toLowerCase()} bookings a month
              </dd>
            </div>
            {view.notes && (
              <div>
                <dt className="text-slate-500">Notes</dt>
                <dd className="text-slate-900">{view.notes}</dd>
              </div>
            )}
          </dl>
          <SubscriptionActions hospitalId={hospitalId} view={view} onDone={sub.reload} />
        </Card>
      )}

      <UsageCard view={view} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AssignForm
          hospitalId={hospitalId}
          plans={plans.data.items}
          current={view}
          onDone={sub.reload}
        />
        <PaymentForm
          hospitalId={hospitalId}
          disabled={!view.plan || view.status === "SUSPENDED" || view.status === "CANCELLED"}
          onDone={sub.reload}
        />
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold text-slate-900">Payments</h2>
        <PaymentsTable payments={view.payments} />
      </Card>
    </>
  );
}

function SubscriptionActions({
  hospitalId,
  view,
  onDone,
}: {
  hospitalId: string;
  view: SubscriptionView;
  onDone: () => void;
}) {
  const [change, setChange] = useState<Change | null>(null);
  const [reason, setReason] = useState("");
  const running = view.status === "ACTIVE" || view.status === "TRIALING";
  const stopped = view.status === "SUSPENDED" || view.status === "CANCELLED";

  const text: Record<Change, { title: string; message: string; label: string }> = {
    suspend: {
      title: "Suspend this hospital's plan?",
      message:
        "Patients cannot book new online appointments until you resume it. Existing appointments and desk bookings carry on.",
      label: "Suspend",
    },
    cancel: {
      title: "Cancel this hospital's plan?",
      message: "Patients cannot book new online appointments. You can resume it later.",
      label: "Cancel plan",
    },
    resume: {
      title: "Resume this hospital's plan?",
      message: "Online bookings open again, subject to the dates of the plan.",
      label: "Resume",
    },
  };

  return (
    <div className="flex flex-wrap gap-2">
      {running && (
        <Button
          variant="secondary"
          className="h-9 px-3 text-red-700"
          onClick={() => {
            setReason("");
            setChange("suspend");
          }}
        >
          Suspend
        </Button>
      )}
      {view.status !== "CANCELLED" && (
        <Button
          variant="ghost"
          className="h-9 px-3 text-red-700"
          onClick={() => {
            setReason("");
            setChange("cancel");
          }}
        >
          Cancel plan
        </Button>
      )}
      {stopped && (
        <Button className="h-9 px-3" onClick={() => setChange("resume")}>
          Resume
        </Button>
      )}
      <ConfirmDialog
        open={change !== null}
        title={change ? text[change].title : ""}
        message={change ? text[change].message : ""}
        danger={change !== "resume"}
        confirmLabel={change ? text[change].label : "OK"}
        onClose={() => setChange(null)}
        onConfirm={async () => {
          await api.post(
            `/admin/subscriptions/${hospitalId}/${change}`,
            change === "resume" ? undefined : { reason: reason.trim() },
          );
          setChange(null);
          onDone();
        }}
      >
        {change !== "resume" && (
          <Textarea
            label="Reason (kept in the audit log)"
            name="reason"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </ConfirmDialog>
    </div>
  );
}

function AssignForm({
  hospitalId,
  plans,
  current,
  onDone,
}: {
  hospitalId: string;
  plans: AdminPlan[];
  current: SubscriptionView;
  onDone: () => void;
}) {
  const choices = plans.filter((p) => p.isActive || p.id === current.plan?.id);
  const [planId, setPlanId] = useState(current.plan?.id ?? choices[0]?.id ?? "");
  const [start, setStart] = useState<Start>("period");
  const [months, setMonths] = useState("1");
  const [days, setDays] = useState("14");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    const count = Number(start === "trial" ? days : months);
    if (start !== "open" && !(Number.isInteger(count) && count >= 1)) {
      return setError(
        start === "trial" ? "Enter the number of trial days." : "Enter the number of months.",
      );
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.put(`/admin/subscriptions/${hospitalId}`, {
        planId,
        ...(start === "trial"
          ? { trialDays: count }
          : start === "period"
            ? { periodMonths: count }
            : {}),
        notes: textOrNull(notes),
      });
      setDone(true);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold text-slate-900">
        {current.plan ? "Change plan" : "Assign a plan"}
      </h2>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Select label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {priceText(p)}
            </option>
          ))}
        </Select>
        <Select
          label="Start with"
          value={start}
          onChange={(e) => setStart(e.target.value as Start)}
        >
          <option value="period">A paid period (months)</option>
          <option value="trial">A trial (days)</option>
          <option value="open">No end date (free plans only)</option>
        </Select>
        {start === "period" && (
          <Field
            label="Months"
            name="months"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        )}
        {start === "trial" && (
          <Field
            label="Trial days"
            name="days"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        )}
        <Textarea
          label="Notes (optional)"
          name="notes"
          maxLength={300}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {current.plan && (
          <p className="text-xs text-slate-500">
            Changing the plan replaces the current dates. Record a payment separately.
          </p>
        )}
        {error && <Alert>{error}</Alert>}
        {done && <Alert tone="info">Saved.</Alert>}
        <Button type="submit" loading={busy} disabled={!planId}>
          {current.plan ? "Change plan" : "Assign plan"}
        </Button>
      </form>
    </Card>
  );
}

function PaymentForm({
  hospitalId,
  disabled,
  onDone,
}: {
  hospitalId: string;
  disabled: boolean;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SubscriptionPaymentMethod>("BANK_TRANSFER");
  const [months, setMonths] = useState("1");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const minor = toMinor(amount);
    const count = Number(months);
    if (Number.isNaN(minor) || minor < 1)
      return setError("Enter the amount received, for example 999.");
    if (!(Number.isInteger(count) && count >= 1))
      return setError("Enter how many months this payment covers.");
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/subscriptions/${hospitalId}/payments`, {
        amount: minor,
        method,
        periodMonths: count,
        reference: textOrNull(reference),
        note: textOrNull(note),
        ...(paidOn ? { paidAt: new Date(`${paidOn}T12:00:00`).toISOString() } : {}),
      });
      setAmount("");
      setReference("");
      setNote("");
      setPaidOn("");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold text-slate-900">Record a payment</h2>
      <p className="text-xs text-slate-500">
        For money you received outside MediQ. It extends the plan from the end of the paid period
        (or from today if it ran out).
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Amount received"
            name="amount"
            prefix="Rs."
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Field
            label="Months covered"
            name="payMonths"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="How"
            value={method}
            onChange={(e) => setMethod(e.target.value as SubscriptionPaymentMethod)}
          >
            {Object.entries(METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Field
            label="Paid on (optional)"
            name="paidOn"
            type="date"
            max={todayIn()}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </div>
        <Field
          label="Reference (optional)"
          name="reference"
          value={reference}
          maxLength={100}
          onChange={(e) => setReference(e.target.value)}
          hint="Bank reference number, cheque number"
        />
        <Textarea
          label="Note (optional)"
          name="note"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} disabled={disabled}>
          Record payment
        </Button>
        {disabled && (
          <p className="text-xs text-slate-500">
            Assign a plan and resume it before recording a payment.
          </p>
        )}
      </form>
    </Card>
  );
}
