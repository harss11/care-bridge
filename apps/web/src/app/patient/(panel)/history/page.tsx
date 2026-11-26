"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/booking/appointment-bits";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { RatingLine } from "@/components/reviews/stars";
import { StatCard } from "@/components/stats/bits";
import {
  Alert,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
} from "@/components/ui";
import { formatDate, formatMoney, formatTime, todayIn } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { HistoryResponse, PatientProfile } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Every visit that already happened, across hospitals and family members. */
export default function HistoryPage() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<"visits" | "all">("visits");
  const [profileId, setProfileId] = useState("");
  const [year, setYear] = useState("");
  const profiles = useApi<{ items: PatientProfile[] }>("/patient/profiles");

  const qs = new URLSearchParams({ page: String(page), limit: "15", scope });
  if (profileId) qs.set("profileId", profileId);
  if (year) qs.set("year", year);
  const { data, error, loading } = useApi<HistoryResponse>(`/patient/history?${qs}`);

  const thisYear = Number(todayIn().slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => String(thisYear - i));
  const reset = () => setPage(1);
  const people = profiles.data?.items ?? [];

  return (
    <>
      <PageHeader title={t("history.title")} subtitle={t("history.subtitle")} />

      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <Select
          label={t("history.who")}
          value={profileId}
          onChange={(e) => {
            setProfileId(e.target.value);
            reset();
          }}
        >
          <option value="">{t("history.everyone")}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </Select>
        <Select
          label={t("history.year")}
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            reset();
          }}
        >
          <option value="">{t("history.allYears")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select
          label={t("history.show")}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as "visits" | "all");
            reset();
          }}
        >
          <option value="visits">{t("history.scopeVisits")}</option>
          <option value="all">{t("history.scopeAll")}</option>
        </Select>
      </Card>

      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t("history.visits")} value={data.summary.visits} />
          <StatCard label={t("history.doctors")} value={data.summary.doctors} />
          <StatCard label={t("history.hospitals")} value={data.summary.hospitals} />
          <StatCard
            label={t("history.paid")}
            value={
              data.summary.spent.length === 0
                ? "—"
                : data.summary.spent.map((s) => formatMoney(s.amount, s.currency)).join(" + ")
            }
            hint={t("history.afterRefunds")}
          />
        </div>
      )}

      {data && data.items.length === 0 && (
        <EmptyState title={t("history.emptyTitle")}>{t("history.emptyText")}</EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className={loading ? "space-y-3 opacity-60" : "space-y-3"}>
            {data.items.map((v) => (
              <li key={v.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-start gap-4">
                    <DoctorAvatar doctor={v.doctor} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{v.doctor.name}</span>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="truncate text-sm text-slate-600">
                        {v.hospital.name} · {v.department}
                      </div>
                      <div className="text-sm text-slate-600">
                        {formatDate(v.date)}, {formatTime(v.slotStart, v.hospital.timezone)} ·{" "}
                        {t("history.forPerson", { name: v.patient.fullName })}
                      </div>
                      {v.reasonForVisit && (
                        <div className="text-sm text-slate-700">
                          {t("history.reason", { reason: v.reasonForVisit })}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium text-slate-900">
                        {v.paidAmount > 0
                          ? formatMoney(v.paidAmount, v.currency)
                          : formatMoney(v.feeAmount, v.currency)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {v.paidAmount > 0 ? t("history.paidLabel") : t("history.feeLabel")}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {v.review && (
                      <RatingLine rating={{ average: v.review.rating, count: 1 }} single />
                    )}
                    {v.source === "ONLINE" && (
                      <Link
                        href={`/patient/appointments/${v.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {v.canReview ? t("history.rate") : t("history.open")}
                      </Link>
                    )}
                    <Link
                      href={`/doctors/${v.doctor.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {t("history.bookAgain")}
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination {...data.pagination} onPage={setPage} />
        </>
      )}
    </>
  );
}
