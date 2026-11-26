"use client";

import {
  NOTICE_TEXT,
  PaymentsTable,
  StateBadge,
  UsageCard,
  endText,
  limitText,
  priceText,
} from "@/components/subscription/bits";
import { Alert, Card, LoadingBlock, PageHeader } from "@/components/ui";
import type { SubscriptionView } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** The hospital's plan, what it includes, how much is used, and the payments MediQ recorded. */
export default function HospitalSubscriptionPage() {
  const { data, error } = useApi<SubscriptionView>("/hospital/subscription");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <LoadingBlock />;
  const notice = data.notice === "none" ? null : NOTICE_TEXT[data.notice];

  return (
    <>
      <PageHeader
        title="Your plan"
        subtitle="Payments are arranged with MediQ directly. To change your plan, contact MediQ."
      />
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {!data.plan ? (
        <Card className="p-4">
          <p className="text-slate-700">
            Your hospital has no plan limits. Everything in MediQ is available to you.
          </p>
        </Card>
      ) : (
        <>
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{data.plan.name}</h2>
                <p className="text-sm text-slate-600">{priceText(data.plan)}</p>
              </div>
              <StateBadge state={data.state} />
            </div>
            {data.plan.description && (
              <p className="text-sm text-slate-700">{data.plan.description}</p>
            )}
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">
                  {data.status === "TRIALING" ? "Trial ends" : "Paid until"}
                </dt>
                <dd className="font-medium text-slate-900">{endText(data)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Included</dt>
                <dd className="font-medium text-slate-900">
                  Bookings and desk
                  {data.plan.analytics ? ", analytics" : ""}
                  {data.plan.slipPrinting ? ", slip printing" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Doctors</dt>
                <dd className="font-medium text-slate-900">{limitText(data.plan.maxDoctors)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Staff logins</dt>
                <dd className="font-medium text-slate-900">{limitText(data.plan.maxStaff)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Online bookings a month</dt>
                <dd className="font-medium text-slate-900">
                  {limitText(data.plan.maxMonthlyBookings)}
                </dd>
              </div>
            </dl>
          </Card>
          <UsageCard view={data} />
        </>
      )}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold text-slate-900">Payments</h2>
        <PaymentsTable payments={data.payments} />
      </Card>
    </>
  );
}
