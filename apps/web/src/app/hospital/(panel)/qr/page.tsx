"use client";

import { QrCard } from "@/components/qr-card";
import { Alert, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { hospitalPageUrl, queuePageUrl } from "@/lib/site";
import type { Doctor, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function QrCodesPage() {
  const { user } = useAuth();
  const hospital = user?.hospital;
  const { data, error } = useApi<Paginated<Doctor>>("/hospital/doctors?limit=100&active=true");
  const doctors = (data?.items ?? []).filter((d) => d.isActive);

  return (
    <>
      <PageHeader
        title="QR codes"
        subtitle="Download or print these for your notice boards, doctors’ doors and waiting areas."
      />

      {hospital && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Hospital</h2>
          {hospital.status !== "ACTIVE" && (
            <Alert tone="info">
              The hospital page opens for patients once Care Bridge approves your hospital.
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QrCard
              title={hospital.name}
              subtitle="Opens your page so patients can book"
              value={hospitalPageUrl(hospital.slug)}
              caption="Scan to book an appointment"
              filename={"mediq-" + hospital.slug + ".png"}
              size={200}
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Doctor queues</h2>
        <p className="text-sm text-slate-600">
          Put a doctor’s code outside their room. Patients scan it to see who is being seen now and
          how long they may wait.
        </p>
        {error && <Alert>{error}</Alert>}
        {!data && !error && <LoadingBlock />}
        {data && doctors.length === 0 && (
          <EmptyState title="No active doctors yet">
            Add doctors to get their queue codes.
          </EmptyState>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <QrCard
              key={d.id}
              title={d.name}
              subtitle={d.department?.name}
              value={queuePageUrl(d.qrToken)}
              caption="Scan for the live queue"
              filename={
                "care-bridge-queue-" + d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png"
              }
              size={200}
            />
          ))}
        </div>
      </section>
    </>
  );
}
