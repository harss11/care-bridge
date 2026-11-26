"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
} from "@/components/ui";
import { BANK_STATUS } from "@/lib/blood";
import type { BloodBankStatus, OwnBloodBank, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Blood banks register themselves; the admin checks each licence before the bank is listed. */
export default function AdminBloodBanksPage() {
  const [status, setStatus] = useState<BloodBankStatus | "">("PENDING_VERIFICATION");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) qs.set("status", status);
  if (search.trim()) qs.set("search", search.trim());
  const { data, error, loading } = useApi<Paginated<OwnBloodBank>>("/admin/blood-banks?" + qs);

  return (
    <>
      <PageHeader
        title="Blood banks"
        subtitle="Check the licence number against the issuing authority before approving."
      />
      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <Select
          label="Show"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BloodBankStatus | "");
            setPage(1);
          }}
        >
          <option value="PENDING_VERIFICATION">Waiting for verification</option>
          <option value="ACTIVE">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="BLOCKED">Blocked</option>
          <option value="">All</option>
        </Select>
        <Field
          label="Search"
          name="search"
          placeholder="Name, city or licence"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </Card>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState title="Nothing here">No blood banks match.</EmptyState>
      )}
      {data && data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((b) => (
              <li key={b.id}>
                <Link
                  href={"/admin/blood-banks/" + b.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{b.name}</div>
                    <div className="text-sm text-slate-600">
                      {b.city} · <span className="font-mono">{b.licenseNumber}</span>
                    </div>
                  </div>
                  <Badge tone={BANK_STATUS[b.status].tone}>{BANK_STATUS[b.status].label}</Badge>
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
