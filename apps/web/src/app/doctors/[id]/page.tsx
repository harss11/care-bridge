"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { SlotPicker } from "@/components/booking/slot-picker";
import { WaitlistInvite } from "@/components/waitlist/waitlist-invite";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { ReviewList } from "@/components/reviews/review-list";
import { RatingLine } from "@/components/reviews/stars";
import { SitePage } from "@/components/site-header";
import { useT } from "@/lib/i18n";
import { Alert, Card, EmptyState, LoadingBlock } from "@/components/ui";
import { directionsUrl, formatDate, formatMoney, formatTime } from "@/lib/format";
import type { PublicDoctorDetail, PublicSlot } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Doctor page: profile, then pick a day and time. Choosing a slot leads to the booking page. */
export default function DoctorPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { data: doctor, error } = useApi<PublicDoctorDetail>(`/public/doctors/${id}`);
  const [picked, setPicked] = useState<{
    slot: PublicSlot & { date: string };
    timezone: string;
  } | null>(null);

  if (error) {
    return (
      <SitePage>
        <EmptyState title="Doctor not found">
          This doctor isn&apos;t available for booking.{" "}
          <Link href="/hospitals" className="font-medium text-brand-700 underline">
            Browse hospitals
          </Link>
        </EmptyState>
      </SitePage>
    );
  }
  if (!doctor) {
    return (
      <SitePage>
        <LoadingBlock />
      </SitePage>
    );
  }
  const h = doctor.hospital;

  return (
    <SitePage>
      <Link
        href={`/h/${h.slug}`}
        className="inline-block text-sm text-slate-600 hover:text-slate-900"
      >
        ← {h.name}
      </Link>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <DoctorAvatar doctor={doctor} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{doctor.name}</h1>
          <p className="text-slate-700">
            {[doctor.department.name, doctor.specialization].filter(Boolean).join(" · ")}
          </p>
          {doctor.qualification && <p className="text-sm text-slate-600">{doctor.qualification}</p>}
          <RatingLine rating={doctor.rating} className="mt-1" />
          <p className="mt-1 text-sm text-slate-600">
            {[
              doctor.experienceYears != null && `${doctor.experienceYears} years experience`,
              doctor.languages.length > 0 && doctor.languages.join(", "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="sm:text-right">
          <div className="text-2xl font-bold text-slate-900">
            {formatMoney(doctor.consultationFee, h.currency)}
          </div>
          <div className="text-xs text-slate-500">consultation fee</div>
        </div>
      </Card>

      {doctor.acceptingBookings === false && <Alert>{t("booking.paused")}</Alert>}

      {doctor.bio && <p className="max-w-2xl text-slate-700">{doctor.bio}</p>}

      <section aria-labelledby="slots-heading" className="space-y-3">
        <h2 id="slots-heading" className="text-lg font-semibold text-slate-900">
          Choose a time
        </h2>
        <SlotPicker
          doctorId={doctor.id}
          selectedId={picked?.slot.id ?? null}
          onSelect={(slot, timezone) => setPicked({ slot, timezone })}
        />
        <WaitlistInvite doctorId={doctor.id} />
        <p className="text-xs text-slate-500">
          {h.name}
          {h.addressLine1 ? `, ${h.addressLine1}` : ""}
          {h.city ? `, ${h.city}` : ""} ·{" "}
          <a
            href={directionsUrl({ ...h })}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Directions
          </a>
        </p>
      </section>

      <section aria-labelledby="reviews-heading" className="space-y-3 pb-24">
        <h2 id="reviews-heading" className="text-lg font-semibold text-slate-900">
          What patients say
        </h2>
        <ReviewList path={`/public/doctors/${doctor.id}/reviews`} />
      </section>

      {picked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-slate-900">
                {formatDate(picked.slot.date)} · {formatTime(picked.slot.startAt, picked.timezone)}
              </div>
              <div className="text-slate-600">
                {formatMoney(doctor.consultationFee, h.currency)}
              </div>
            </div>
            <Link
              href={`/patient/book/${picked.slot.id}`}
              className="inline-flex h-11 shrink-0 items-center rounded-xl bg-brand-700 px-6 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Continue
            </Link>
          </div>
        </div>
      )}
    </SitePage>
  );
}
