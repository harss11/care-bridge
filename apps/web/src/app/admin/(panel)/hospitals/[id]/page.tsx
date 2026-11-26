"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { HospitalForm } from "@/components/admin/hospital-form";
import { CredentialsModal } from "@/components/credentials-modal";
import { ConfirmDialog } from "@/components/modal";
import { QrCard } from "@/components/qr-card";
import {
  Alert,
  Badge,
  Button,
  Card,
  HospitalStatusBadge,
  LoadingBlock,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";
import { hospitalPageUrl } from "@/lib/site";
import type { Credentials, Hospital, HospitalDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Action = "approve" | "block" | "unblock" | "reset" | null;

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: h, error, reload } = useApi<HospitalDetail>(`/admin/hospitals/${id}`);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [saved, setSaved] = useState(false);

  if (error) return <Alert>{error}</Alert>;
  if (!h) return <LoadingBlock />;

  const close = () => setAction(null);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/hospitals", label: "Hospitals" }}
        title={h.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <HospitalStatusBadge status={h.status} />
            <span>/h/{h.slug}</span>
            <span>· Added {formatDateTime(h.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Link
              href={`/admin/subscriptions/${h.id}`}
              className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Plan
            </Link>
            {h.status === "PENDING_APPROVAL" && (
              <Button onClick={() => setAction("approve")}>Approve</Button>
            )}
            {h.status !== "BLOCKED" ? (
              <Button variant="secondary" onClick={() => setAction("block")}>
                Block
              </Button>
            ) : (
              <Button onClick={() => setAction("unblock")}>Unblock</Button>
            )}
            <Button variant="secondary" onClick={() => setAction("reset")}>
              Reset login
            </Button>
          </>
        }
      />

      {h.status === "BLOCKED" && (
        <Alert>
          Blocked {formatDateTime(h.blockedAt)}: {h.blockedReason}. Staff cannot log in and patients
          cannot book.
        </Alert>
      )}
      {saved && <Alert tone="success">Changes saved.</Alert>}

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Departments", h.counts.departments],
          ["Doctors", h.counts.doctors],
          ["Appointments", h.counts.appointments],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-600 sm:text-sm">{label}</div>
          </Card>
        ))}
      </div>

      {h.status === "ACTIVE" && (
        <div className="max-w-xs">
          <QrCard
            title={h.name}
            subtitle="Patients scan this to open the hospital page and book"
            value={hospitalPageUrl(h.slug)}
            caption="Scan to book an appointment"
            filename={"mediq-" + h.slug + ".png"}
          />
        </div>
      )}

      <Card className="p-0">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
          Staff logins
        </h2>
        <ul className="divide-y divide-slate-100">
          {h.staff.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
            >
              <div>
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="font-mono text-xs text-slate-600">{s.loginId}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{ROLE_LABEL[s.role]}</Badge>
                {s.status === "BLOCKED" && <Badge tone="red">Blocked</Badge>}
                {s.mustChangePassword && <Badge tone="amber">Temp password</Badge>}
                <span className="text-xs text-slate-500">
                  Last login {s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "never"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Details</h2>
        <HospitalForm
          key={h.updatedAt}
          hospital={h}
          submitLabel="Save changes"
          onSubmit={async (body) => {
            await api.patch<Hospital>(`/admin/hospitals/${id}`, body);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            reload();
          }}
        />
      </div>

      <ConfirmDialog
        open={action === "approve"}
        title="Approve hospital?"
        message="The hospital becomes visible to patients and can take bookings."
        confirmLabel="Approve"
        onClose={close}
        onConfirm={async () => {
          await api.post(`/admin/hospitals/${id}/approve`);
          reload();
        }}
      />
      <ConfirmDialog
        open={action === "block"}
        title="Block hospital?"
        danger
        confirmLabel="Block"
        message="All staff are signed out immediately and patients can no longer book. Existing data is kept."
        onClose={close}
        onConfirm={async () => {
          await api.post(`/admin/hospitals/${id}/block`, { reason });
          setReason("");
          reload();
        }}
      >
        <Textarea
          label="Reason (recorded in the audit log)"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={action === "unblock"}
        title="Unblock hospital?"
        message={
          h.approvedAt
            ? "The hospital becomes active again."
            : "The hospital returns to pending approval."
        }
        confirmLabel="Unblock"
        onClose={close}
        onConfirm={async () => {
          await api.post(`/admin/hospitals/${id}/unblock`);
          reload();
        }}
      />
      <ConfirmDialog
        open={action === "reset"}
        title="Reset hospital login?"
        message="A new temporary password is generated and the hospital admin is signed out everywhere. They must set a new password at next login."
        confirmLabel="Reset password"
        onClose={close}
        onConfirm={async () => {
          setCredentials(
            await api.post<Credentials>(`/admin/hospitals/${id}/reset-credentials`, {}),
          );
          reload();
        }}
      />
      <CredentialsModal
        title="New temporary password"
        credentials={credentials}
        onClose={() => setCredentials(null)}
      />
    </>
  );
}
