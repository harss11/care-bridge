"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ComingSoon } from "@/components/dashboard-shell";
import { AdminDashboard } from "@/components/stats/admin-dashboard";
import { Alert, Card, PageHeader, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { AuditLogEntry, HospitalListItem, Paginated } from "@/lib/types";

export default function AdminOverviewPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? ""}`} subtitle="Platform administration" />
      <HospitalStats />
      <AdminDashboard />
      <RecentActivity />
      <ComingSoon
        items={[
          { title: "Blood banks", description: "Verify licensed blood banks (later phase)." },
        ]}
      />
    </>
  );
}

/** Totals per status, using the paginated list endpoint with limit=1. */
function HospitalStats() {
  const all = useApi<Paginated<HospitalListItem>>("/admin/hospitals?limit=1");
  const pending = useApi<Paginated<HospitalListItem>>(
    "/admin/hospitals?limit=1&status=PENDING_APPROVAL",
  );
  const blocked = useApi<Paginated<HospitalListItem>>("/admin/hospitals?limit=1&status=BLOCKED");
  const stats = [
    { label: "Hospitals", value: all.data?.pagination.total, href: "/admin/hospitals" },
    {
      label: "Pending approval",
      value: pending.data?.pagination.total,
      href: "/admin/hospitals?status=PENDING_APPROVAL",
    },
    {
      label: "Blocked",
      value: blocked.data?.pagination.total,
      href: "/admin/hospitals?status=BLOCKED",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <Link
          key={s.label}
          href={s.href}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <div className="text-2xl font-bold text-slate-900">{s.value ?? "–"}</div>
          <div className="text-xs text-slate-600 sm:text-sm">{s.label}</div>
        </Link>
      ))}
    </div>
  );
}

function RecentActivity() {
  const [data, setData] = useState<Paginated<AuditLogEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Paginated<AuditLogEntry>>("/admin/audit-logs?limit=10")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load activity"));
  }, []);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 className="font-semibold text-slate-900">Recent activity (audit log)</h2>
        {data && <span className="text-xs text-slate-500">{data.pagination.total} total</span>}
      </div>
      {error && (
        <div className="p-6">
          <Alert>{error}</Alert>
        </div>
      )}
      {!data && !error && (
        <div className="flex justify-center p-8 text-brand-700">
          <Spinner />
        </div>
      )}
      {data && data.items.length === 0 && (
        <p className="p-6 text-sm text-slate-500">No activity yet.</p>
      )}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-2 font-medium">When</th>
                <th className="px-6 py-2 font-medium">Action</th>
                <th className="px-6 py-2 font-medium">Actor</th>
                <th className="px-6 py-2 font-medium">Hospital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                    {new Date(log.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-900">{log.action}</td>
                  <td className="px-6 py-3 text-slate-700">{log.actor?.name ?? "System"}</td>
                  <td className="px-6 py-3 text-slate-700">{log.hospital?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
