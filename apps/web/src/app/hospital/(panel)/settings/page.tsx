"use client";

import { useState, type FormEvent } from "react";
import { EmergencyCard } from "@/components/hospital/emergency-card";
import { Alert, Button, Card, Field, LoadingBlock, PageHeader, Textarea } from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { describeRefundPolicy, textOrNull } from "@/lib/format";
import type { Hospital } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function HospitalSettingsPage() {
  const { data, error, setData } = useApi<Hospital>("/hospital/profile");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <LoadingBlock />;

  return (
    <>
      <PageHeader title="Settings" subtitle="Shown to patients on your booking page." />
      <ProfileForm hospital={data} onSaved={setData} />
      <EmergencyCard hospital={data} onSaved={setData} />
      <Card className="space-y-1 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">Managed by MediQ</h2>
        <p>
          Name: <span className="text-slate-900">{data.name}</span> · Booking URL:{" "}
          <span className="font-mono text-slate-900">/h/{data.slug}</span> · Commission:{" "}
          <span className="text-slate-900">{data.commissionPercent}%</span>
        </p>
        <p>
          Patient cancellations:{" "}
          <span className="text-slate-900">
            {describeRefundPolicy({
              fullRefundHours: data.refundFullHours,
              partialPercent: data.refundPartialPercent,
            })}
          </span>
        </p>
        <p>Contact MediQ support to change these.</p>
      </Card>
    </>
  );
}

function ProfileForm({
  hospital,
  onSaved,
}: {
  hospital: Hospital;
  onSaved: (h: Hospital) => void;
}) {
  const s = (v: string | number | null) => (v == null ? "" : String(v));
  const [v, setV] = useState({
    phone: s(hospital.phone),
    email: s(hospital.email),
    addressLine1: s(hospital.addressLine1),
    addressLine2: s(hospital.addressLine2),
    city: s(hospital.city),
    state: s(hospital.state),
    postalCode: s(hospital.postalCode),
    latitude: s(hospital.latitude),
    longitude: s(hospital.longitude),
    description: s(hospital.description),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((p) => ({ ...p, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    setSaved(false);
    const coord = (x: string) => (x.trim() === "" ? null : Number(x));
    const latitude = coord(v.latitude);
    const longitude = coord(v.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setErrors({ latitude: "Enter a decimal number, e.g. 28.5677" });
      return;
    }
    setBusy(true);
    try {
      const h = await api.patch<Hospital>("/hospital/profile", {
        phone: v.phone.trim(),
        email: v.email.trim(),
        addressLine1: textOrNull(v.addressLine1),
        addressLine2: textOrNull(v.addressLine2),
        city: textOrNull(v.city),
        state: textOrNull(v.state),
        postalCode: textOrNull(v.postalCode),
        latitude,
        longitude,
        description: textOrNull(v.description),
      });
      onSaved(h);
      setSaved(true);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <h2 className="font-semibold text-slate-900">Contact & address</h2>
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">Saved.</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Phone"
            name="phone"
            type="tel"
            value={v.phone}
            onChange={set("phone")}
            error={errors.phone}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={v.email}
            onChange={set("email")}
            error={errors.email}
          />
          <Field
            label="Address line 1"
            name="addressLine1"
            value={v.addressLine1}
            onChange={set("addressLine1")}
            error={errors.addressLine1}
          />
          <Field
            label="Address line 2"
            name="addressLine2"
            value={v.addressLine2}
            onChange={set("addressLine2")}
            error={errors.addressLine2}
          />
          <Field
            label="City"
            name="city"
            value={v.city}
            onChange={set("city")}
            error={errors.city}
          />
          <Field
            label="State"
            name="state"
            value={v.state}
            onChange={set("state")}
            error={errors.state}
          />
          <Field
            label="PIN code"
            name="postalCode"
            inputMode="numeric"
            value={v.postalCode}
            onChange={set("postalCode")}
            error={errors.postalCode}
          />
          <div />
          <Field
            label="Latitude"
            name="latitude"
            inputMode="decimal"
            value={v.latitude}
            onChange={set("latitude")}
            error={errors.latitude}
            hint="Right-click your building on Google Maps to copy it"
          />
          <Field
            label="Longitude"
            name="longitude"
            inputMode="decimal"
            value={v.longitude}
            onChange={set("longitude")}
            error={errors.longitude}
          />
          <Textarea
            label="About the hospital"
            name="description"
            value={v.description}
            onChange={set("description")}
            error={errors.description}
            className="sm:col-span-2"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
