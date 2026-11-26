"use client";

import { useState, type FormEvent } from "react";
import { BloodDisclaimer, BloodGroupSelect } from "@/components/blood/blood-bits";
import { ConfirmDialog } from "@/components/modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
} from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { bloodLabel, formatWhen } from "@/lib/blood";
import type {
  BloodGroup,
  DonorProfileView,
  Gender,
  MyDonation,
  ResponderRequest,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

const WHY: Record<string, string> = {
  TOO_YOUNG: "You are under the minimum age to donate.",
  TOO_OLD: "You are over the maximum age to donate.",
  WAITING_PERIOD: "You donated recently and need to wait before the next donation.",
};

export default function DonorPage() {
  const { data, error, reload } = useApi<{ profile: DonorProfileView | null }>("/donor/profile");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <LoadingBlock />;
  return data.profile ? (
    <Registered profile={data.profile} reload={reload} />
  ) : (
    <>
      <PageHeader
        title="Become a blood donor"
        subtitle="When someone near you urgently needs your blood group, we send you an SMS. You choose whether to help."
      />
      <BloodDisclaimer />
      <DonorForm initial={null} onSaved={reload} />
    </>
  );
}

function Registered({ profile, reload }: { profile: DonorProfileView; reload: () => void }) {
  const donations = useApi<{ items: MyDonation[] }>("/donor/donations");
  const requests = useApi<{ items: ResponderRequest[] }>("/donor/requests");
  useAutoRefresh(requests.reload, 15_000);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy("toggle");
    setError(null);
    try {
      await api.patch("/donor/availability", { isAvailable: !profile.isAvailable });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function answer(id: string, response: "CAN_HELP" | "CANNOT") {
    setBusy(id);
    setError(null);
    try {
      await api.post("/donor/requests/" + id + "/respond", { response });
      requests.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Blood donor" subtitle="Thank you for being ready to help." />
      <BloodDisclaimer />
      {error && <Alert>{error}</Alert>}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-red-600 text-xl font-bold text-white">
              {bloodLabel(profile.bloodGroup)}
            </div>
            <div>
              <div className="font-semibold text-slate-900">{profile.city}</div>
              <div className="text-sm text-slate-600">
                {profile.lastDonationAt
                  ? "Last donated " + formatWhen(profile.lastDonationAt).split(",")[0]
                  : "No donation recorded yet"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={profile.eligible ? "green" : "amber"}>
              {profile.eligible ? "You can donate" : "Not yet"}
            </Badge>
            <Badge tone={profile.isAvailable ? "green" : "slate"}>
              {profile.isAvailable ? "Alerts on" : "Alerts paused"}
            </Badge>
          </div>
        </div>
        {!profile.eligible && (
          <Alert tone="info">
            {profile.ineligibleReasons.map((r) => WHY[r]).join(" ")}
            {profile.nextEligibleAt
              ? " You can donate again from " +
                formatWhen(profile.nextEligibleAt).split(",")[0] +
                "."
              : ""}{" "}
            We will not alert you until then.
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === "toggle"} onClick={toggle}>
            {profile.isAvailable ? "Pause alerts" : "Turn alerts on"}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(!editing)}>
            {editing ? "Close" : "Edit my details"}
          </Button>
          <Button
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            onClick={() => setRemoving(true)}
          >
            Stop being a donor
          </Button>
        </div>
      </Card>

      {editing && (
        <DonorForm
          initial={profile}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}

      <section className="space-y-3" aria-label="Requests near you">
        <h2 className="text-lg font-semibold text-slate-900">Requests near you</h2>
        {requests.data && requests.data.items.length === 0 && (
          <EmptyState title="Nobody needs your blood group right now">
            We will send an SMS if that changes.
          </EmptyState>
        )}
        {requests.data?.items.map((r) => (
          <Card key={r.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">
                  {r.unitsNeeded} unit{r.unitsNeeded === 1 ? "" : "s"} of {bloodLabel(r.bloodGroup)}{" "}
                  at {r.hospitalName}
                </div>
                <div className="text-sm text-slate-600">
                  {r.city}
                  {r.distanceKm != null ? " · " + r.distanceKm.toFixed(1) + " km from you" : ""} ·
                  asked by {r.requesterFirstName}
                </div>
              </div>
              {r.urgency === "EMERGENCY" && <Badge tone="red">Emergency</Badge>}
            </div>
            {r.note && <p className="text-sm text-slate-700">“{r.note}”</p>}
            {r.myResponse === "CAN_HELP" ? (
              <Alert tone="success">
                You said you can help. The person who asked can now call you. Please go to{" "}
                {r.hospitalName} only after checking with the hospital or blood bank, and only if
                you are well.
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy === r.id}
                disabled={r.myResponse === "CAN_HELP" || !profile.eligible}
                onClick={() => answer(r.id, "CAN_HELP")}
              >
                I can help
              </Button>
              <Button
                variant="secondary"
                disabled={busy === r.id || r.myResponse === "CANNOT"}
                onClick={() => answer(r.id, r.myResponse === "CAN_HELP" ? "CANNOT" : "CANNOT")}
              >
                {r.myResponse === "CAN_HELP" ? "I can no longer help" : "I cannot"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              If you tap I can help, your phone number is shown to the person who asked, until the
              request closes.
            </p>
          </Card>
        ))}
      </section>

      <section className="space-y-3" aria-label="My donations">
        <h2 className="text-lg font-semibold text-slate-900">My donations</h2>
        {donations.data && donations.data.items.length === 0 && (
          <EmptyState title="No donations recorded yet">
            Blood banks record a donation when you give blood with them.
          </EmptyState>
        )}
        {donations.data && donations.data.items.length > 0 && (
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {donations.data.items.map((d) => (
                <li key={d.id} className="px-5 py-3 text-sm">
                  <span className="font-medium text-slate-900">
                    {formatWhen(d.donatedAt).split(",")[0]}
                  </span>{" "}
                  <Badge tone="red">{bloodLabel(d.bloodGroup)}</Badge>
                  <span className="text-slate-600">
                    {" "}
                    · {d.volumeMl} ml · {d.bloodBank}, {d.city}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <p className="text-xs text-slate-500">
          A donation is a record made by the blood bank. Nothing is issued to you and there is
          nothing to redeem.
        </p>
      </section>

      <ConfirmDialog
        open={removing}
        title="Stop being a donor?"
        message="Your donor details and any answers you gave are removed. The blood bank keeps its own record of your past donations, no longer linked to you."
        confirmLabel="Stop being a donor"
        danger
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          await api.delete("/donor/profile");
          reload();
        }}
      />
    </>
  );
}

function DonorForm({
  initial,
  onSaved,
}: {
  initial: DonorProfileView | null;
  onSaved: () => void;
}) {
  const [group, setGroup] = useState<BloodGroup | "">(initial?.bloodGroup ?? "");
  const [gender, setGender] = useState<Gender | "">(initial?.gender ?? "");
  const [dob, setDob] = useState(initial?.dateOfBirth ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [place, setPlace] = useState<{ lat: number; lng: number } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setPlace({
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lng: Math.round(pos.coords.longitude * 1000) / 1000,
        }),
      () =>
        setError(
          "We could not get your location. Your city is enough: you will be alerted about requests in it.",
        ),
      { timeout: 12_000 },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await api.put("/donor/profile", {
        bloodGroup: group,
        gender,
        dateOfBirth: dob,
        city: city.trim(),
        latitude: place?.lat ?? null,
        longitude: place?.lng ?? null,
        ...(initial ? {} : { acceptAlerts: accepted }),
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setErrors(fieldErrors(err));
      setBusy(false);
    }
  }

  const ready =
    !!group && !!gender && !!dob && city.trim().length >= 2 && (initial !== null || accepted);

  return (
    <form onSubmit={submit} noValidate>
      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">{initial ? "Your details" : "About you"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <BloodGroupSelect value={group} onChange={setGroup} error={errors.bloodGroup} />
          <Select
            label="Gender"
            value={gender}
            error={errors.gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
          >
            <option value="">Choose</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="UNDISCLOSED">Prefer not to say</option>
          </Select>
        </div>
        <p className="text-xs text-slate-500">
          Gender sets the waiting period between donations (about 3 months for men, 4 months for
          women and anyone who prefers not to say).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Date of birth"
            name="dob"
            type="date"
            value={dob}
            error={errors.dateOfBirth}
            onChange={(e) => setDob(e.target.value)}
          />
          <Field
            label="City"
            name="city"
            value={city}
            error={errors.city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={useMyLocation}>
            {place
              ? "Location added ✓"
              : initial?.hasLocation
                ? "Update my location"
                : "Use my location"}
          </Button>
          <span className="text-sm text-slate-500">
            Optional. Saved only to about 1 km, to find requests near you.
          </span>
        </div>
        {!initial && (
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label="I agree to be alerted by SMS about blood requests near me, and I understand my phone number is shown to the person who asked only if I tap “I can help”."
            hint="You can pause alerts or stop being a donor at any time."
          />
        )}
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} disabled={!ready}>
          {initial ? "Save changes" : "Become a donor"}
        </Button>
      </Card>
    </form>
  );
}
