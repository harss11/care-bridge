"use client";

import { useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  LoadingBlock,
  PageHeader,
} from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { textOrNull } from "@/lib/format";
import type { BloodBankStatus, OwnBloodBank } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const STATUS: Record<
  BloodBankStatus,
  { label: string; tone: "green" | "amber" | "red" | "slate" }
> = {
  PENDING_VERIFICATION: { label: "Waiting for verification", tone: "amber" },
  ACTIVE: { label: "Verified and listed", tone: "green" },
  REJECTED: { label: "Not verified", tone: "red" },
  BLOCKED: { label: "Blocked", tone: "red" },
};

export default function BloodBankProfilePage() {
  const { data, error, reload } = useApi<OwnBloodBank>("/blood-bank/profile");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <LoadingBlock />;
  // Keyed by the saved time so the form starts again from what is stored after each save.
  return (
    <ProfileForm
      key={data.verifiedAt + data.status + data.addressLine1}
      bank={data}
      onSaved={reload}
    />
  );
}

function ProfileForm({ bank, onSaved }: { bank: OwnBloodBank; onSaved: () => void }) {
  const rejected = bank.status === "REJECTED";
  const [f, setF] = useState({
    name: bank.name,
    licenseNumber: bank.licenseNumber,
    licenseAuthority: bank.licenseAuthority ?? "",
    licenseValidUntil: bank.licenseValidUntil ?? "",
    addressLine1: bank.addressLine1,
    city: bank.city,
    state: bank.state ?? "",
    postalCode: bank.postalCode ?? "",
    operatingHours: bank.operatingHours ?? "",
    email: bank.email ?? "",
  });
  const [is24x7, setIs24x7] = useState(bank.is24x7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    setSaved(false);
    try {
      await api.patch("/blood-bank/profile", {
        ...(rejected
          ? {
              name: f.name.trim(),
              licenseNumber: f.licenseNumber.trim(),
              licenseAuthority: textOrNull(f.licenseAuthority),
            }
          : {}),
        licenseValidUntil: f.licenseValidUntil,
        addressLine1: f.addressLine1.trim(),
        city: f.city.trim(),
        state: textOrNull(f.state),
        postalCode: textOrNull(f.postalCode),
        operatingHours: textOrNull(f.operatingHours),
        email: f.email.trim(),
        is24x7,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Blood bank profile"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS[bank.status].tone}>{STATUS[bank.status].label}</Badge>
            <span className="font-mono text-sm">{bank.licenseNumber}</span>
          </span>
        }
      />
      {rejected && (
        <Alert>
          MediQ could not verify this blood bank: <strong>{bank.rejectedReason}</strong>. Correct
          the details below and save to send it for verification again.
        </Alert>
      )}
      <form onSubmit={submit} noValidate>
        <Card className="space-y-4">
          <Field
            label="Name"
            name="name"
            value={f.name}
            disabled={!rejected}
            onChange={set("name")}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Licence number"
              name="license"
              error={errors.licenseNumber}
              disabled={!rejected}
              value={f.licenseNumber}
              onChange={set("licenseNumber")}
            />
            <Field
              label="Issued by"
              name="authority"
              disabled={!rejected}
              value={f.licenseAuthority}
              onChange={set("licenseAuthority")}
            />
          </div>
          {!rejected && (
            <p className="text-xs text-slate-500">
              The name and licence are locked once verified. To change them, contact MediQ support.
            </p>
          )}
          <Field
            label="Licence valid until"
            name="valid"
            type="date"
            value={f.licenseValidUntil}
            error={errors.licenseValidUntil}
            onChange={set("licenseValidUntil")}
          />
          <Field
            label="Address"
            name="address"
            value={f.addressLine1}
            error={errors.addressLine1}
            onChange={set("addressLine1")}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" name="city" value={f.city} onChange={set("city")} />
            <Field label="State" name="state" value={f.state} onChange={set("state")} />
            <Field label="PIN code" name="pin" value={f.postalCode} onChange={set("postalCode")} />
          </div>
          <Checkbox label="Open 24 hours" checked={is24x7} onChange={setIs24x7} />
          {!is24x7 && (
            <Field
              label="Opening hours"
              name="hours"
              value={f.operatingHours}
              onChange={set("operatingHours")}
            />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            value={f.email}
            error={errors.email}
            onChange={set("email")}
          />
          <p className="text-xs text-slate-500">
            Public phone number: <strong>{bank.phone}</strong>. It was verified with a code at
            registration and cannot be changed here.
          </p>
          {error && <Alert>{error}</Alert>}
          {saved && <Alert tone="success">{rejected ? "Saved." : "Saved."}</Alert>}
          <Button type="submit" loading={busy}>
            {rejected ? "Save and resubmit" : "Save changes"}
          </Button>
        </Card>
      </form>
    </>
  );
}
