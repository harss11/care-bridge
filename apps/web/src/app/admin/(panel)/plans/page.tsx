"use client";

import { useState } from "react";
import { PlanForm } from "@/components/admin/plan-form";
import { Modal } from "@/components/modal";
import { limitText, priceText } from "@/components/subscription/bits";
import { Alert, Badge, Button, Card, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import type { AdminPlan } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** The plans hospitals can be put on. Payment is handled offline: see Subscriptions. */
export default function PlansPage() {
  const { data, error, reload } = useApi<{ items: AdminPlan[] }>("/admin/plans");
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Limits and features for hospitals. Changing a plan applies to every hospital on it straight away."
        actions={<Button onClick={() => setEditing("new")}>New plan</Button>}
      />
      {error && <Alert>{error}</Alert>}
      {!data && !error && <LoadingBlock />}
      {data && data.items.length === 0 && <EmptyState title="No plans yet" />}
      {data && data.items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.items.map((p) => (
            <li key={p.id}>
              <Card className="h-full space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-900">{p.name}</h2>
                    <p className="text-xs text-slate-500">{p.code}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!p.isActive && <Badge tone="slate">Switched off</Badge>}
                    <Badge tone="blue">
                      {p.hospitals} {p.hospitals === 1 ? "hospital" : "hospitals"}
                    </Badge>
                  </div>
                </div>
                <p className="text-lg font-bold text-slate-900">{priceText(p)}</p>
                {p.description && <p className="text-sm text-slate-600">{p.description}</p>}
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Doctors</dt>
                    <dd className="font-medium">{limitText(p.maxDoctors)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Staff</dt>
                    <dd className="font-medium">{limitText(p.maxStaff)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Bookings a month</dt>
                    <dd className="font-medium">{limitText(p.maxMonthlyBookings)}</dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-600">
                  {[p.analytics && "Analytics", p.slipPrinting && "Slip printing"]
                    .filter(Boolean)
                    .join(" · ") || "Essentials only"}
                </p>
                <Button variant="secondary" className="h-9 px-3" onClick={() => setEditing(p)}>
                  Edit
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        title={editing === "new" ? "New plan" : "Edit plan"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <PlanForm
            plan={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}
