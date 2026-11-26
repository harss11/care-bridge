"use client";

import Link from "next/link";
import { ComingSoon } from "@/components/dashboard-shell";
import { EmergencyCard } from "@/components/hospital/emergency-card";
import { Alert, HospitalStatusBadge, LoadingBlock, PageHeader } from "@/components/ui";
import type { Hospital } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface Summary {
  hospital: Hospital;
  counts: {
    departments: number;
    doctors: number;
    activeDoctors: number;
    receptionists: number;
    upcomingSlots: number;
  };
}

export default function HospitalOverviewPage() {
  const { data, error, setData } = useApi<Summary>("/hospital/summary");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <LoadingBlock />;
  const { hospital, counts } = data;

  const stats = [
    {
      label: "Doctors",
      value: `${counts.activeDoctors}/${counts.doctors}`,
      hint: "active",
      href: "/hospital/doctors",
    },
    { label: "Departments", value: counts.departments, href: "/hospital/departments" },
    { label: "Receptionists", value: counts.receptionists, href: "/hospital/staff" },
    {
      label: "Open slots",
      value: counts.upcomingSlots,
      hint: "next 7 days",
      href: "/hospital/doctors",
    },
  ];

  const nextSteps = [
    counts.departments === 0 && { href: "/hospital/departments", text: "Add your departments" },
    counts.doctors === 0 && { href: "/hospital/doctors", text: "Add doctors with fees and photos" },
    counts.doctors > 0 &&
      counts.upcomingSlots === 0 && {
        href: "/hospital/doctors",
        text: "Set doctors' weekly schedules so slots open",
      },
    counts.receptionists === 0 && { href: "/hospital/staff", text: "Create a receptionist login" },
  ].filter(Boolean) as Array<{ href: string; text: string }>;

  return (
    <>
      <PageHeader
        title={hospital.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <HospitalStatusBadge status={hospital.status} />
            <span>Booking page: /h/{hospital.slug}</span>
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
          >
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-sm text-slate-600">
              {s.label}
              {s.hint && <span className="text-xs text-slate-500"> · {s.hint}</span>}
            </div>
          </Link>
        ))}
      </div>

      {nextSteps.length > 0 && (
        <Alert tone="info">
          <p className="font-medium">Finish setting up</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {nextSteps.map((s) => (
              <li key={s.text}>
                <Link href={s.href} className="underline">
                  {s.text}
                </Link>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <EmergencyCard hospital={hospital} onSaved={(h) => setData({ ...data, hospital: h })} />

      <ComingSoon
        items={[
          { title: "Appointments", description: "Today's and upcoming bookings with analytics." },
          { title: "Hospital QR", description: "Download a QR that opens your booking page." },
        ]}
      />
    </>
  );
}
