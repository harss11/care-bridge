"use client";

import { useState } from "react";
import { BarChart, HBars } from "@/components/stats/charts";
import { MoneyBlock, OutstandingRefunds, StatCard, pct } from "@/components/stats/bits";
import { PeriodPicker, periodQuery, type Period } from "@/components/stats/period-picker";
import { Alert, Card, EmptyState, LoadingBlock, PageHeader, Select } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { Doctor, HospitalAnalytics, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const short = (date: string) => date.slice(8) + "/" + date.slice(5, 7);
const hourLabel = (h: number) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? "am" : "pm");

export default function HospitalAnalyticsPage() {
  const [period, setPeriod] = useState<Period>({ days: 30 });
  const [doctorId, setDoctorId] = useState("");
  const doctors = useApi<Paginated<Doctor>>("/hospital/doctors?limit=100");
  const qs = periodQuery(period) + (doctorId ? "&doctorId=" + doctorId : "");
  const { data, error, loading } = useApi<HospitalAnalytics>("/hospital/analytics?" + qs);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={
          data
            ? formatDate(data.range.from) +
              " to " +
              formatDate(data.range.to) +
              " (" +
              data.range.days +
              " days)"
            : "Bookings, money and busy times"
        }
      />
      <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
        <PeriodPicker value={period} onChange={setPeriod} />
        <Select
          label="Doctor"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          className="min-w-52"
        >
          <option value="">All doctors</option>
          {(doctors.data?.items ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Card>

      {error && <Alert>{error}</Alert>}
      {!data && !error && <LoadingBlock />}
      {data && data.bookings.total === 0 && (
        <EmptyState title="No bookings in this period">
          Pick a longer period, or come back once patients have booked.
        </EmptyState>
      )}
      {data && data.bookings.total > 0 && (
        <div className={loading ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Bookings"
              value={data.bookings.total}
              hint={data.bookings.online + " online · " + data.bookings.walkIn + " walk-in"}
            />
            <StatCard
              label="Patients seen"
              value={data.bookings.completed}
              hint={data.bookings.active + " still to come"}
            />
            <StatCard
              label="Cancelled"
              value={pct(data.bookings.cancellationRate)}
              hint={data.bookings.cancelled + " bookings"}
            />
            <StatCard
              label="No-shows"
              value={pct(data.bookings.noShowRate)}
              hint={data.bookings.noShow + " patients"}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Average wait"
              value={
                data.service.avgWaitMinutes == null ? "–" : data.service.avgWaitMinutes + " min"
              }
              hint="check-in to the doctor"
            />
            <StatCard
              label="Average consultation"
              value={
                data.service.avgConsultMinutes == null
                  ? "–"
                  : data.service.avgConsultMinutes + " min"
              }
              hint="with the doctor"
            />
            <StatCard
              label="Booked online"
              value={pct(data.bookings.onlineShare)}
              hint="the rest are walk-ins"
            />
          </div>

          <OutstandingRefunds rows={data.refundsOutstanding} asHospital />

          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">Money</h2>
            <MoneyBlock m={data.money} asHospital />
            <p className="text-xs text-slate-500">
              Online payments count on the day they were paid and refunds on the day they were
              processed. The Care Bridge fee is charged only on online money you keep after refunds.
              Cash at the desk has no fee.
            </p>
          </div>

          <Card className="grid gap-6 lg:grid-cols-2">
            <BarChart
              title="Bookings per day (by visit date)"
              bars={data.daily.map((d) => ({
                label: short(d.date),
                value: d.booked,
                text:
                  formatDate(d.date) +
                  ": " +
                  d.booked +
                  " booked, " +
                  d.cancelled +
                  " cancelled, " +
                  d.noShow +
                  " no-show",
              }))}
            />
            <BarChart
              title="When patients come (by hour of day)"
              tone="bg-sky-600"
              bars={data.byHour.map((h) => ({ label: hourLabel(h.hour), value: h.count }))}
            />
          </Card>

          <Card className="grid gap-8 lg:grid-cols-2">
            <HBars
              title="Doctors (bookings)"
              rows={data.byDoctor.map((d) => ({
                label: d.name,
                value: d.booked,
                note:
                  formatMoney(d.revenueKept, data.currency) +
                  (d.noShowRate != null ? " · " + d.noShowRate + "% no-show" : ""),
              }))}
            />
            <HBars
              title="Departments (bookings)"
              tone="bg-sky-600"
              rows={data.byDepartment.map((d) => ({ label: d.name, value: d.booked }))}
            />
          </Card>
        </div>
      )}
    </>
  );
}
