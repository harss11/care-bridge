"use client";

import Link from "next/link";
import { AppointmentRow } from "@/components/booking/appointment-bits";
import { ComingSoon } from "@/components/dashboard-shell";
import { Card, LoadingBlock, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { Appointment, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function PatientHomePage() {
  const { user } = useAuth();
  const upcoming = useApi<Paginated<Appointment>>("/appointments?scope=upcoming&limit=3");

  return (
    <>
      <PageHeader title={`Hi, ${user?.name ?? ""}`} subtitle={user?.phone} />

      <Card className="flex flex-col gap-3 border-brand-200 bg-brand-50 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-brand-900">Need to see a doctor?</h2>
          <p className="text-sm text-brand-900/80">
            Pick a hospital, a doctor and a time. You get your token instantly.
          </p>
        </div>
        <Link
          href="/hospitals"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 px-6 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Book an appointment
        </Link>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Upcoming</h2>
          <Link
            href="/patient/appointments"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            See all
          </Link>
        </div>
        {!upcoming.data && !upcoming.error && <LoadingBlock />}
        {upcoming.data && upcoming.data.items.length === 0 && (
          <p className="text-sm text-slate-600">No upcoming appointments.</p>
        )}
        {upcoming.data && upcoming.data.items.length > 0 && (
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {upcoming.data.items.map((a) => (
                <li key={a.id}>
                  <AppointmentRow appointment={a} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <ComingSoon
        items={[
          { title: "Receipts", description: "Download receipts for every payment." },
          { title: "Emergency", description: "Find nearby hospitals with beds, no login needed." },
        ]}
      />
    </>
  );
}
