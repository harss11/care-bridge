"use client";

import Link from "next/link";
import { useState } from "react";
import { AppointmentRow } from "@/components/booking/appointment-bits";
import { Alert, Card, EmptyState, LoadingBlock, PageHeader, Pagination, cx } from "@/components/ui";
import type { Appointment, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
] as const;

export default function AppointmentsPage() {
  const [scope, setScope] = useState<(typeof TABS)[number]["value"]>("upcoming");
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi<Paginated<Appointment>>(
    `/appointments?scope=${scope}&page=${page}&limit=10`,
  );

  return (
    <>
      <PageHeader
        title="My appointments"
        actions={
          <Link
            href="/hospitals"
            className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Book new
          </Link>
        }
      />
      <div role="tablist" className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={scope === t.value}
            onClick={() => {
              setScope(t.value);
              setPage(1);
            }}
            className={cx(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium",
              scope === t.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState
          title={scope === "upcoming" ? "No upcoming appointments" : "No past appointments yet"}
        >
          {scope === "upcoming" && (
            <Link href="/hospitals" className="font-medium text-brand-700 underline">
              Find a doctor
            </Link>
          )}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((a) => (
              <li key={a.id}>
                <AppointmentRow appointment={a} />
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-5 py-3">
            <Pagination {...data.pagination} onPage={setPage} />
          </div>
        </Card>
      )}
    </>
  );
}
