"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/modal";
import { Alert, Badge, Button, Card, LoadingBlock, PageHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { BANK_STATUS } from "@/lib/blood";
import { formatDateTime } from "@/lib/format";
import type { OwnBloodBank, StaffUser } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Detail = OwnBloodBank & {
  verifiedByName: string | null;
  staff: StaffUser[];
  donations: number;
};
type Action = "approve" | "reject" | "block" | "unblock" | null;

/** One blood bank: the licence details to check, and the decision. */
export default function AdminBloodBankPage() {
  const { id } = useParams<{ id: string }>();
  const { data: b, error, reload } = useApi<Detail>("/admin/blood-banks/" + id);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");

  if (error) return <Alert>{error}</Alert>;
  if (!b) return <LoadingBlock />;
  const close = () => {
    setAction(null);
    setReason("");
  };
  const needsReason = action === "reject" || action === "block";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/blood-banks", label: "Blood banks" }}
        title={b.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={BANK_STATUS[b.status].tone}>{BANK_STATUS[b.status].label}</Badge>
            <span>Registered {formatDateTime(b.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {b.status === "PENDING_VERIFICATION" && (
              <>
                <Button onClick={() => setAction("approve")}>Approve</Button>
                <Button variant="secondary" onClick={() => setAction("reject")}>
                  Reject
                </Button>
              </>
            )}
            {b.status === "ACTIVE" && (
              <Button variant="secondary" onClick={() => setAction("block")}>
                Block
              </Button>
            )}
            {b.status === "BLOCKED" && (
              <Button onClick={() => setAction("unblock")}>Unblock</Button>
            )}
          </>
        }
      />

      {b.status === "REJECTED" && (
        <Alert>
          Rejected: {b.rejectedReason}. The blood bank can fix the details and resubmit.
        </Alert>
      )}
      {b.status === "BLOCKED" && (
        <Alert>
          Blocked {b.blockedReason ? "(" + b.blockedReason + ")" : ""}. Its staff cannot sign in and
          it is not listed.
        </Alert>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Licence to check</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Licence number" value={b.licenseNumber} mono />
          <Item label="Issued by" value={b.licenseAuthority} />
          <Item label="Valid until" value={b.licenseValidUntil} />
          <Item
            label="Verified by"
            value={
              b.verifiedAt
                ? (b.verifiedByName ?? "an admin") + ", " + formatDateTime(b.verifiedAt)
                : null
            }
          />
        </dl>
        <p className="text-xs text-slate-500">
          Check this number with the issuing authority (the State Drugs Control office) and that the
          name and address match before approving.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Contact and place</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Phone (verified by code)" value={b.phone} />
          <Item label="Email" value={b.email} />
          <Item
            label="Address"
            value={[b.addressLine1, b.city, b.state, b.postalCode].filter(Boolean).join(", ")}
          />
          <Item label="Hours" value={b.is24x7 ? "Open 24 hours" : b.operatingHours} />
        </dl>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Staff and activity</h2>
        <p className="text-sm text-slate-600">
          {b.donations} donation{b.donations === 1 ? "" : "s"} recorded
        </p>
        <ul className="divide-y divide-slate-100 text-sm">
          {b.staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium text-slate-900">{s.name}</span>{" "}
                <span className="font-mono text-slate-600">{s.loginId}</span>
              </span>
              <span className="text-slate-500">
                last login {s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "never"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={action !== null}
        title={
          action === "approve"
            ? "Approve this blood bank?"
            : action === "reject"
              ? "Reject this blood bank?"
              : action === "block"
                ? "Block this blood bank?"
                : "Unblock this blood bank?"
        }
        message={
          action === "approve"
            ? "It will be listed for the public, receive emergency alerts and be able to record donations. Only approve after checking the licence."
            : action === "block"
              ? "Its staff are signed out at once, and it is no longer listed or alerted."
              : action === "reject"
                ? "Say what is wrong so they can fix it and resubmit."
                : "Its staff can sign in again and it is listed again."
        }
        confirmLabel={action ? action[0]!.toUpperCase() + action.slice(1) : "Confirm"}
        danger={action === "block"}
        onClose={close}
        onConfirm={async () => {
          if (needsReason && reason.trim().length < 5)
            throw new Error("Please give a reason of at least 5 characters.");
          await api.post(
            "/admin/blood-banks/" + id + "/" + action,
            needsReason ? { reason: reason.trim() } : undefined,
          );
          reload();
        }}
      >
        {needsReason && (
          <Textarea
            label="Reason"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </ConfirmDialog>
    </>
  );
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={mono ? "font-mono text-slate-900" : "text-slate-900"}>
        {value || "Not given"}
      </dd>
    </div>
  );
}
