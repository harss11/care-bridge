"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BloodDisclaimer } from "@/components/blood/blood-bits";
import { PhoneCodeFields, usePhoneCode } from "@/components/blood/phone-code";
import { SitePage } from "@/components/site-header";
import { Alert, Button, Card, Checkbox, Field } from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { textOrNull } from "@/lib/format";

/** A licensed blood bank registers. It is listed and can work only after MediQ has checked its licence. */
export default function RegisterBloodBankPage() {
  const phone = usePhoneCode("BANK_REGISTRATION");
  const [f, setF] = useState({
    name: "",
    licenseNumber: "",
    licenseAuthority: "",
    licenseValidUntil: "",
    email: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    operatingHours: "",
    staffName: "",
    loginId: "",
    password: "",
  });
  const [is24x7, setIs24x7] = useState(false);
  const [place, setPlace] = useState<{ lat: number; lng: number } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setPlace({
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lng: Math.round(pos.coords.longitude * 10000) / 10000,
        }),
      () =>
        setError("We could not get the location. You can add it later in the blood bank profile."),
      { timeout: 12_000 },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await api.post(
        "/blood/banks/register",
        {
          name: f.name.trim(),
          licenseNumber: f.licenseNumber.trim(),
          licenseAuthority: textOrNull(f.licenseAuthority),
          licenseValidUntil: f.licenseValidUntil,
          phone: phone.phone,
          code: phone.code,
          email: f.email.trim(),
          addressLine1: f.addressLine1.trim(),
          city: f.city.trim(),
          state: textOrNull(f.state),
          postalCode: textOrNull(f.postalCode),
          latitude: place?.lat ?? null,
          longitude: place?.lng ?? null,
          is24x7,
          operatingHours: textOrNull(f.operatingHours),
          staff: {
            name: f.staffName.trim(),
            loginId: f.loginId.trim().toLowerCase(),
            password: f.password,
          },
          acceptPrivacyPolicy: accepted,
          acceptTerms: accepted,
        },
        { auth: false },
      );
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
      const fe = fieldErrors(err);
      setErrors({
        code: fe.code ?? "",
        license: fe.licenseNumber ?? "",
        loginId: fe["staff.loginId"] ?? "",
        password: fe["staff.password"] ?? "",
        email: fe.email ?? "",
      });
      setBusy(false);
    }
  }

  if (done) {
    return (
      <SitePage>
        <Card className="space-y-3">
          <h1 className="text-2xl font-bold text-slate-900">
            Thank you: we will check your licence
          </h1>
          <p className="text-slate-600">
            Your blood bank is registered but not listed yet. MediQ checks the licence number and
            then approves it. You can sign in now to see where you stand and to prepare your stock.
          </p>
          <Link
            href="/blood-bank/login"
            className="inline-flex h-11 w-fit items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Blood bank sign in
          </Link>
        </Card>
      </SitePage>
    );
  }

  const ready =
    phone.sent &&
    phone.code.length === 6 &&
    accepted &&
    f.name.trim() &&
    f.licenseNumber.trim() &&
    f.addressLine1.trim() &&
    f.city.trim() &&
    f.staffName.trim() &&
    f.loginId.trim() &&
    f.password.length >= 10;

  return (
    <SitePage>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Register a blood bank</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          For licensed blood banks only. You record donations and your stock, and answer emergency
          requests nearby.
        </p>
      </div>
      <BloodDisclaimer />
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">1. The blood bank</h2>
          <Field label="Name" name="name" value={f.name} onChange={set("name")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Licence number"
              name="license"
              error={errors.license || undefined}
              value={f.licenseNumber}
              onChange={set("licenseNumber")}
            />
            <Field
              label="Issued by (optional)"
              name="authority"
              value={f.licenseAuthority}
              onChange={set("licenseAuthority")}
            />
          </div>
          <Field
            label="Licence valid until (optional)"
            name="valid"
            type="date"
            value={f.licenseValidUntil}
            onChange={set("licenseValidUntil")}
          />
          <Field
            label="Address"
            name="address"
            value={f.addressLine1}
            onChange={set("addressLine1")}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" name="city" value={f.city} onChange={set("city")} />
            <Field label="State" name="state" value={f.state} onChange={set("state")} />
            <Field label="PIN code" name="pin" value={f.postalCode} onChange={set("postalCode")} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={useMyLocation}>
              {place ? "Location added ✓" : "Use this device's location"}
            </Button>
            <span className="text-sm text-slate-500">
              Optional. Helps patients find you and lets us alert you about nearby requests.
            </span>
          </div>
          <Checkbox label="Open 24 hours" checked={is24x7} onChange={setIs24x7} />
          {!is24x7 && (
            <Field
              label="Opening hours (optional)"
              name="hours"
              value={f.operatingHours}
              onChange={set("operatingHours")}
            />
          )}
          <Field
            label="Email (optional)"
            name="email"
            type="email"
            error={errors.email || undefined}
            value={f.email}
            onChange={set("email")}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">2. The blood bank phone</h2>
          <PhoneCodeFields
            state={phone}
            phoneLabel="Phone number of the blood bank"
            hint="A mobile number that can receive SMS. Public: patients call it. Emergency alerts come here."
            codeError={errors.code || undefined}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">3. Your login</h2>
          <Field
            label="Your name"
            name="staffName"
            value={f.staffName}
            onChange={set("staffName")}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Login ID"
              name="loginId"
              hint="Lower-case letters, digits, dots or dashes."
              error={errors.loginId || undefined}
              value={f.loginId}
              onChange={set("loginId")}
              autoCapitalize="none"
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 10 characters with a letter and a number."
              error={errors.password || undefined}
              value={f.password}
              onChange={set("password")}
            />
          </div>
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label="I confirm this is a licensed blood bank and I accept the privacy policy and terms."
            hint="You can add colleagues later."
          />
          <p className="text-sm text-slate-600">
            Read the{" "}
            <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-medium text-brand-700 hover:underline">
              terms
            </Link>
            .
          </p>
        </Card>

        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} disabled={!ready}>
          Register the blood bank
        </Button>
      </form>
    </SitePage>
  );
}
