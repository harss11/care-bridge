"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Alert,
  Card,
  EmptyState,
  HospitalStatusBadge,
  LoadingBlock,
  PageHeader,
  Pagination,
  cx,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { HospitalListItem, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING_APPROVAL", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "BLOCKED", label: "Blocked" },
];

export default function HospitalsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <HospitalsList />
    </Suspense>
  );
}

function HospitalsList() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) qs.set("status", status);
  if (debounced) qs.set("search", debounced);
  const { data, error, loading } = useApi<Paginated<HospitalListItem>>(`/admin/hospitals?${qs}`);

  return (
    <>
      <PageHeader
        title="Hospitals"
        actions={
          <Link
            href="/admin/hospitals/new"
            className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Add hospital
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setPage(1);
                router.replace(t.value ? `/admin/hospitals?status=${t.value}` : "/admin/hospitals");
              }}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                status === t.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search name, city or URL"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 sm:w-72"
        />
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState title="No hospitals found">
          {status || debounced ? "Try another filter." : "Add your first hospital to get started."}
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/admin/hospitals/${h.id}`}
                  className="flex flex-col gap-2 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{h.name}</span>
                      <HospitalStatusBadge status={h.status} />
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      {[h.city, h.state].filter(Boolean).join(", ")} · /h/{h.slug}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 sm:text-right">
                    <span>{h.doctorCount} doctors</span>
                    <span>{h.commissionPercent}% commission</span>
                    <span title="Hospital login">
                      {h.adminLogin?.loginId ?? "no login"}
                      {h.adminLogin?.mustChangePassword && " (temp password)"}
                    </span>
                    <span className="text-xs text-slate-500">
                      Added {formatDateTime(h.createdAt)}
                    </span>
                  </div>
                </Link>
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
