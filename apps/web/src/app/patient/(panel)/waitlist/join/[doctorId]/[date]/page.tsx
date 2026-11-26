"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { RELATION_LABEL } from "@/components/patient/profile-form";
import { Alert, Button, Card, EmptyState, LoadingBlock, PageHeader, cx } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { PatientProfile, PublicDoctorDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Join the waitlist for one fully booked day: choose who it is for, and confirm. */
export default function JoinWaitlistPage() {
  const t = useT();
  const { doctorId, date } = useParams<{ doctorId: string; date: string }>();
  const router = useRouter();
  const doctor = useApi<PublicDoctorDetail>(`/public/doctors/${doctorId}`, { auth: false });
  const profiles = useApi<{ items: PatientProfile[] }>("/patient/profiles");
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);

  if (doctor.error) {
    return (
      <EmptyState title={t("waitlist.noDoctor")}>
        <Link href="/hospitals" className="font-medium text-brand-700 underline">
          {t("waitlist.browse")}
        </Link>
      </EmptyState>
    );
  }
  if (!doctor.data || !profiles.data) return <LoadingBlock />;

  const d = doctor.data;
  const people = profiles.data.items;
  const profileId =
    chosen ?? people.find((p) => p.relation === "SELF")?.id ?? people[0]?.id ?? null;

  async function join() {
    if (!profileId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/waitlist", { doctorId, date, patientProfileId: profileId });
      router.replace("/patient/waitlist");
    } catch (err) {
      setError({ message: errorMessage(err), code: err instanceof ApiError ? err.code : "" });
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("waitlist.joinTitle")}
        back={{ href: `/doctors/${d.id}`, label: d.name }}
      />

      <Card className="flex items-center gap-4">
        <DoctorAvatar doctor={d} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{d.name}</div>
          <div className="text-sm text-slate-600">
            {d.department.name} · {d.hospital.name}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">{formatDate(date)}</div>
        </div>
      </Card>

      <section className="space-y-3" aria-labelledby="who-heading">
        <h2 id="who-heading" className="font-semibold text-slate-900">
          {t("waitlist.who")}
        </h2>
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

      <Alert tone="info">{t("waitlist.joinNote")}</Alert>

      {error && (
        <Alert>
          {error.message}{" "}
          {error.code === "SLOTS_AVAILABLE" && (
            <Link href={`/doctors/${d.id}`} className="font-medium underline">
              {t("waitlist.pickTime")}
            </Link>
          )}
          {error.code === "WAITLIST_LIMIT" && (
            <Link href="/patient/waitlist" className="font-medium underline">
              {t("waitlist.myWaitlist")}
            </Link>
          )}
        </Alert>
      )}

      <div className="flex justify-end">
        <Button onClick={join} loading={busy} disabled={!profileId}>
          {t("waitlist.join")}
        </Button>
      </div>
    </>
  );
}
