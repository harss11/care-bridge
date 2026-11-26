"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/modal";
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
  Textarea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { bloodLabel, formatWhen } from "@/lib/blood";
import type { BloodGroup, BloodRequestStatus, BloodUrgency, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface AdminRequest {
  id: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  urgency: BloodUrgency;
  hospitalName: string;
  city: string;
  status: BloodRequestStatus;
  requesterName: string;
  requesterPhone: string;
  createdAt: string;
  expiresAt: string;
  alertedDonors: number;
  alertedBanks: number;
  helpers: number;
}

const TONE: Record<BloodRequestStatus, "amber" | "green" | "slate"> = {
  OPEN: "amber",
  FULFILLED: "green",
  CANCELLED: "slate",
  EXPIRED: "slate",
};

/** Emergency requests, for oversight. The admin sees a masked phone number and can stop an abusive request. */
export default function AdminBloodRequestsPage() {
  const [status, setStatus] = useState<BloodRequestStatus | "">("OPEN");
  const [page, setPage] = useState(1);
  const [stopping, setStopping] = useState<AdminRequest | null>(null);
  const [reason, setReason] = useState("");
  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) qs.set("status", status);
  const { data, error, loading, reload } = useApi<Paginated<AdminRequest>>(
    "/admin/blood-requests?" + qs,
  );

  return (
    <>
      <PageHeader
        title="Blood requests"
        subtitle="Emergency requests made by the public. Stop one if it looks fake or abusive."
      />
      <Card className="p-4">
        <Select
          label="Show"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BloodRequestStatus | "");
            setPage(1);
          }}
        >
          <option value="OPEN">Open now</option>
          <option value="FULFILLED">Blood found</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
          <option value="">All</option>
        </Select>
      </Card>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && <EmptyState title="No requests" />}
      {data && data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {bloodLabel(r.bloodGroup)} · {r.unitsNeeded} unit
                      {r.unitsNeeded === 1 ? "" : "s"} · {r.hospitalName}, {r.city}
                    </span>
                    <Badge tone={TONE[r.status]}>{r.status.toLowerCase()}</Badge>
                    {r.urgency === "EMERGENCY" && <Badge tone="red">Emergency</Badge>}
                  </div>
                  <div className="text-sm text-slate-600">
                    {r.requesterName} · {r.requesterPhone} · {formatWhen(r.createdAt)} · alerted{" "}
                    {r.alertedDonors} donors and {r.alertedBanks} banks · {r.helpers} can help
                  </div>
                </div>
                {r.status === "OPEN" && (
                  <Button
                    variant="ghost"
                    className="h-9 px-3 text-red-700 hover:bg-red-50"
                    onClick={() => setStopping(r)}
                  >
                    Stop
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-5 py-3">
            <Pagination {...data.pagination} onPage={setPage} />
          </div>
        </Card>
      )}
      <ConfirmDialog
        open={!!stopping}
        title="Stop this request?"
        message="It is cancelled for everyone: donors' numbers are hidden and nobody can answer it any more."
        confirmLabel="Stop the request"
        danger
        onClose={() => {
          setStopping(null);
          setReason("");
        }}
        onConfirm={async () => {
          if (reason.trim().length < 5)
            throw new Error("Please give a reason of at least 5 characters.");
          await api.post("/admin/blood-requests/" + stopping!.id + "/cancel", {
            reason: reason.trim(),
          });
          reload();
        }}
      >
        <Textarea
          label="Reason (kept in the audit log)"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </>
  );
}
