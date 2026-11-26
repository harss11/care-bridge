"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BloodDisclaimer, BloodGroupSelect } from "@/components/blood/blood-bits";
import { PhoneCodeFields, usePhoneCode } from "@/components/blood/phone-code";
import { SitePage } from "@/components/site-header";
import { Alert, Button, Card, Checkbox, Field, Select, Textarea } from "@/components/ui";
import { ApiError, api, errorMessage, fieldErrors } from "@/lib/api";
import { saveRequestKey } from "@/lib/blood";
import { textOrNull } from "@/lib/format";
import type { BloodGroup, BloodUrgency, RequesterRequest } from "@/lib/types";

/** Ask for blood in an emergency. The phone is proved with a code; donors and blood banks near the hospital are alerted. */
export default function BloodRequestPage() {
  const router = useRouter();
  const phone = usePhoneCode("REQUEST");
  const [name, setName] = useState("");
  const [group, setGroup] = useState<BloodGroup | "">("");
  const [units, setUnits] = useState("1");
  const [urgency, setUrgency] = useState<BloodUrgency>("EMERGENCY");
  const [hospital, setHospital] = useState("");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState("25");
  const [note, setNote] = useState("");
  const [place, setPlace] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function useMyLocation() {
    if (!navigator.geolocation) return setError("This browser cannot share your location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPlace({
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lng: Math.round(pos.coords.longitude * 1000) / 1000,
        });
      },
      () => {
        setLocating(false);
        setError("We could not get your location. The city is enough to find help nearby.");
      },
      { timeout: 12_000 },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    setDuplicate(false);
    setBusy(true);
    try {
      const result = await api.post<{ request: RequesterRequest; key: string }>(
        "/blood/requests",
        {
          phone: phone.phone,
          code: phone.code,
          requesterName: name.trim(),
          bloodGroup: group,
          unitsNeeded: Number(units),
          urgency,
          hospitalName: hospital.trim(),
          city: city.trim(),
          latitude: place?.lat ?? null,
          longitude: place?.lng ?? null,
          radiusKm: Number(radius),
          note: textOrNull(note),
          acceptDisclaimer: accepted,
        },
        { auth: false },
      );
      saveRequestKey(result.request.id, result.key);
      router.replace("/blood/request/" + result.request.id);
    } catch (err) {
      setError(errorMessage(err));
      setDuplicate(err instanceof ApiError && err.code === "DUPLICATE_REQUEST");
      const fe = fieldErrors(err);
      setErrors({
        code: fe.code ?? "",
        name: fe.requesterName ?? "",
        hospital: fe.hospitalName ?? "",
        city: fe.city ?? "",
      });
      setBusy(false);
    }
  }

  const ready =
    phone.sent &&
    phone.code.length === 6 &&
    !!group &&
    !!name.trim() &&
    !!hospital.trim() &&
    !!city.trim() &&
    accepted;

  return (
    <SitePage>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ask for blood</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          We send an SMS to donors of the same blood group and to blood banks near the hospital.
          Anyone who can help tells us, and only then do you see how to reach them.
        </p>
      </div>
      <BloodDisclaimer />

      <form onSubmit={submit} className="space-y-6" noValidate>
        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">1. Your phone number</h2>
          <PhoneCodeFields
            state={phone}
            hint="We check it is yours with a code. It is shown only to donors who say they can help."
            codeError={errors.code || undefined}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">2. What is needed</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <BloodGroupSelect value={group} onChange={setGroup} />
            <Field
              label="Units"
              name="units"
              type="number"
              min={1}
              max={10}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
            />
            <Select
              label="How urgent"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as BloodUrgency)}
            >
              <option value="EMERGENCY">Emergency: within hours</option>
              <option value="URGENT">Urgent: today</option>
            </Select>
          </div>
          <Field
            label="Hospital where the patient is"
            name="hospital"
            value={hospital}
            error={errors.hospital || undefined}
            onChange={(e) => setHospital(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="City"
              name="city"
              value={city}
              error={errors.city || undefined}
              onChange={(e) => setCity(e.target.value)}
            />
            <Select
              label="Look for donors within"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            >
              {[5, 10, 25, 50].map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" loading={locating} onClick={useMyLocation}>
              {place ? "Using your location ✓" : "Use my location"}
            </Button>
            <span className="text-sm text-slate-500">
              Optional. Without it we match donors by city.
            </span>
          </div>
          <Textarea
            label="Note for donors (optional)"
            maxLength={200}
            hint="Keep it short. Do not write medical details or phone numbers."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">3. About you</h2>
          <Field
            label="Your name"
            name="requester"
            value={name}
            error={errors.name || undefined}
            onChange={(e) => setName(e.target.value)}
          />
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label="I understand that Care Bridge only connects people. It does not provide or test blood, and I will not pay anyone for blood through Care Bridge."
          />
        </Card>

        {error && <Alert>{error}</Alert>}
        {duplicate && (
          <p className="text-sm">
            <Link href="/blood/request/find" className="font-semibold text-brand-800 underline">
              Find my request
            </Link>
          </p>
        )}
        <Button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 sm:w-auto"
          loading={busy}
          disabled={!ready}
        >
          Alert donors and blood banks
        </Button>
      </form>
    </SitePage>
  );
}
