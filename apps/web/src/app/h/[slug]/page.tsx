"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { ReviewList } from "@/components/reviews/review-list";
import { RatingLine } from "@/components/reviews/stars";
import { SitePage } from "@/components/site-header";
import { Alert, Card, EmptyState, LoadingBlock, PageHeader, Pagination, cx } from "@/components/ui";
import { directionsUrl, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type {
  Paginated,
  PublicDepartment,
  PublicDoctor,
  PublicHospital,
  Rating,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** /h/{slug}: the page a hospital's QR code opens, with the hospital already chosen. */
export default function HospitalPage() {
  const t = useT();
  const { slug } = useParams<{ slug: string }>();
  const info = useApi<{
    hospital: PublicHospital;
    rating: Rating;
    acceptingBookings: boolean;
    departments: PublicDepartment[];
  }>(`/public/hospitals/${slug}`);
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (departmentId) qs.set("departmentId", departmentId);
  const doctors = useApi<Paginated<PublicDoctor>>(
    info.data ? `/public/hospitals/${slug}/doctors?${qs}` : null,
  );

  if (info.error) {
    return (
      <SitePage>
        <EmptyState title="Hospital not found">
          This hospital isn&apos;t open for booking.{" "}
          <Link href="/hospitals" className="font-medium text-brand-700 underline">
            Browse hospitals
          </Link>
        </EmptyState>
      </SitePage>
    );
  }
  if (!info.data) {
    return (
      <SitePage>
        <LoadingBlock />
      </SitePage>
    );
  }
  const { hospital, departments, rating, acceptingBookings } = info.data;

  return (
    <SitePage>
      <PageHeader
        title={hospital.name}
        subtitle={[hospital.addressLine1, hospital.city, hospital.state].filter(Boolean).join(", ")}
        actions={
          <>
            <a
              href={directionsUrl({ ...hospital })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Directions
            </a>
            {hospital.phone && (
              <a
                href={`tel:${hospital.phone}`}
                className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Call
              </a>
            )}
          </>
        }
      />
      <RatingLine rating={rating} />
      {!acceptingBookings && <Alert>{t("booking.paused")}</Alert>}
      {hospital.description && <p className="max-w-2xl text-slate-700">{hospital.description}</p>}

      <section aria-labelledby="dept-heading" className="space-y-3">
        <h2 id="dept-heading" className="font-semibold text-slate-900">
          Choose a department
        </h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "", name: "All doctors", doctorCount: 0 }, ...departments].map((d) => (
            <button
              key={d.id}
              aria-pressed={departmentId === d.id}
              onClick={() => {
                setDepartmentId(d.id);
                setPage(1);
              }}
              className={cx(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap",
                departmentId === d.id
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:border-brand-400",
              )}
            >
              {d.name}
              {d.id && <span className="ml-1.5 opacity-70">{d.doctorCount}</span>}
            </button>
          ))}
        </div>
      </section>

      {doctors.error && <Alert>{doctors.error}</Alert>}
      {doctors.loading && !doctors.data && <LoadingBlock />}
      {doctors.data && doctors.data.items.length === 0 && (
        <EmptyState title="No doctors in this department yet" />
      )}
      {doctors.data && doctors.data.items.length > 0 && (
        <>
          <ul className="grid gap-3">
            {doctors.data.items.map((d) => (
              <li key={d.id}>
                <Link href={`/doctors/${d.id}`} className="block">
                  <Card className="flex items-center gap-4 p-4 transition hover:border-brand-400">
                    <DoctorAvatar doctor={d} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{d.name}</div>
                      <div className="truncate text-sm text-slate-600">
                        {[d.department.name, d.specialization].filter(Boolean).join(" · ")}
                      </div>
                      {d.qualification && (
                        <div className="truncate text-xs text-slate-500">{d.qualification}</div>
                      )}
                      <RatingLine rating={d.rating} className="mt-0.5" />
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {formatMoney(d.consultationFee, hospital.currency)}
                      </div>
                      <div className="text-xs font-medium text-brand-700">Book →</div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination {...doctors.data.pagination} onPage={setPage} />
        </>
      )}

      <section aria-labelledby="reviews-heading" className="space-y-3 pb-8">
        <h2 id="reviews-heading" className="font-semibold text-slate-900">
          What patients say
        </h2>
        <ReviewList path={`/public/hospitals/${slug}/reviews`} showDoctor />
      </section>
    </SitePage>
  );
}
