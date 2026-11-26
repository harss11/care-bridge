"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { DoctorForm } from "@/components/hospital/doctor-form";
import { Modal } from "@/components/modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
} from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { Department, Doctor, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function DoctorsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (departmentId) qs.set("departmentId", departmentId);
  if (debounced) qs.set("search", debounced);
  const { data, error, loading } = useApi<Paginated<Doctor>>(`/hospital/doctors?${qs}`);
  const departments = useApi<Paginated<Department>>("/hospital/departments?limit=100");

  return (
    <>
      <PageHeader
        title="Doctors"
        actions={<Button onClick={() => setAdding(true)}>Add doctor</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="search"
          placeholder="Search name or specialization"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <Select
          label="Department"
          name="department"
          className="[&>label]:sr-only"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All departments</option>
          {departments.data?.items.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState title="No doctors found">
          {departmentId || debounced ? "Try another filter." : "Add your first doctor."}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/hospital/doctors/${d.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                >
                  <DoctorAvatar doctor={d} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{d.name}</span>
                      {!d.isActive && <Badge>Inactive</Badge>}
                      {d.login && <Badge tone="blue">Has login</Badge>}
                    </div>
                    <div className="truncate text-sm text-slate-600">
                      {d.department?.name}
                      {d.specialization && ` · ${d.specialization}`}
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium text-slate-900">
                    {formatMoney(d.consultationFee)}
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

      <Modal open={adding} title="Add doctor" onClose={() => setAdding(false)}>
        {adding && (
          <DoctorForm
            submitLabel="Add doctor"
            onCancel={() => setAdding(false)}
            onSaved={(d) => router.push(`/hospital/doctors/${d.id}?tab=schedule`)}
          />
        )}
      </Modal>
    </>
  );
}
