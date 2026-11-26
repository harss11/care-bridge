"use client";

import Link from "next/link";
import { useState } from "react";
import { StateBadge } from "@/components/subscription/bits";
import {
  Alert,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Paginated, SubscriptionListRow } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const NOTE: Record<string, string> = {
  ending_soon: "Ends soon",
  grace: "Payment due: still taking bookings",
  expired: "Not taking online bookings",
  suspended: "Suspended",
  cancelled: "Cancelled",
  none: "",
};

/** Hospitals whose plan is ending, overdue, suspended or cancelled: who to chase for payment. */
export default function SubscriptionsPage() {
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi<Paginated<SubscriptionListRow>>(
    `/admin/subscriptions?filter=${filter}&page=${page}&limit=25`,
  );

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Payments are received offline. Open a hospital to assign a plan or record a payment."
        actions={
          <Select
            label="Show"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as "attention" | "all");
              setPage(1);
            }}
          >
            <option value="attention">Needs attention</option>
            <option value="all">All hospitals</option>
          </Select>
        }
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState
          title={filter === "attention" ? "Nothing needs attention" : "No subscriptions yet"}
        >
          {filter === "attention"
            ? "No plan is ending within a week, overdue, suspended or cancelled."
            : ""}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {data.items.map((r) => (
                <li key={r.hospitalId}>
                  <Link
                    href={`/admin/subscriptions/${r.hospitalId}`}
                    className="flex flex-col gap-1 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{r.hospital}</span>
                        <StateBadge state={r.state} />
                      </div>
                      <div className="text-sm text-slate-600">
                        {r.plan.name}
                        {NOTE[r.notice] ? ` · ${NOTE[r.notice]}` : ""}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 sm:text-right">
                      {r.endsAt ? `Ends ${formatDate(r.endsAt.slice(0, 10))}` : "No end date"}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination {...data.pagination} onPage={setPage} />
        </>
      )}
    </>
  );
}
