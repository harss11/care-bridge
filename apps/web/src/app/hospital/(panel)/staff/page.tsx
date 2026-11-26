"use client";

import { useState, type FormEvent } from "react";
import { CredentialsModal } from "@/components/credentials-modal";
import { ConfirmDialog, Modal } from "@/components/modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  Pagination,
} from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";
import type { Credentials, Paginated, StaffUser } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Pending = { kind: "reset" | "block" | "unblock"; user: StaffUser } | null;

export default function StaffPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<StaffUser>>(
    `/hospital/staff?page=${page}&limit=20`,
  );
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [credentials, setCredentials] = useState<{ title: string; value: Credentials } | null>(
    null,
  );

  return (
    <>
      <PageHeader
        title="Staff logins"
        subtitle="Receptionists book walk-ins and take cash; doctors see their queue."
        actions={<Button onClick={() => setAdding(true)}>Add receptionist</Button>}
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState title="No staff logins yet">
          Add a receptionist here. Doctor logins are created from the doctor&apos;s page.
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{u.name}</span>
                    <Badge tone="blue">{ROLE_LABEL[u.role]}</Badge>
                    {u.status === "BLOCKED" && <Badge tone="red">Blocked</Badge>}
                    {u.mustChangePassword && <Badge tone="amber">Temp password</Badge>}
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-mono">{u.loginId}</span>
                    {u.contactPhone && ` · ${u.contactPhone}`}
                    {` · last login ${u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "never"}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 px-3"
                    onClick={() => setPending({ kind: "reset", user: u })}
                  >
                    Reset password
                  </Button>
                  {u.status === "ACTIVE" ? (
                    <Button
                      variant="ghost"
                      className="h-9 px-3 text-red-700"
                      onClick={() => setPending({ kind: "block", user: u })}
                    >
                      Block
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="h-9 px-3"
                      onClick={() => setPending({ kind: "unblock", user: u })}
                    >
                      Unblock
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-5 py-3">
            <Pagination {...data.pagination} onPage={setPage} />
          </div>
        </Card>
      )}

      <Modal open={adding} title="Add receptionist" onClose={() => setAdding(false)}>
        {adding && (
          <ReceptionistForm
            onCancel={() => setAdding(false)}
            onCreated={(c) => {
              setAdding(false);
              setCredentials({ title: "Receptionist login created", value: c });
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={pending?.kind === "reset"}
        title={`Reset password for ${pending?.user.name ?? ""}?`}
        message="They are signed out everywhere and must set a new password at next login."
        confirmLabel="Reset password"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const c = await api.post<Credentials>(
            `/hospital/staff/${pending!.user.id}/reset-password`,
          );
          setCredentials({ title: "New temporary password", value: c });
          reload();
        }}
      />
      <ConfirmDialog
        open={pending?.kind === "block"}
        title={`Block ${pending?.user.name ?? ""}?`}
        message="They are signed out immediately and cannot log in until unblocked."
        danger
        confirmLabel="Block"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          await api.post(`/hospital/staff/${pending!.user.id}/block`);
          reload();
        }}
      />
      <ConfirmDialog
        open={pending?.kind === "unblock"}
        title={`Unblock ${pending?.user.name ?? ""}?`}
        message="They can log in again with their current password."
        confirmLabel="Unblock"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          await api.post(`/hospital/staff/${pending!.user.id}/unblock`);
          reload();
        }}
      />
      <CredentialsModal
        title={credentials?.title}
        credentials={credentials?.value ?? null}
        onClose={() => setCredentials(null)}
      />
    </>
  );
}

function ReceptionistForm({
  onCreated,
  onCancel,
}: {
  onCreated: (c: Credentials) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await api.post<{ credentials: Credentials }>("/hospital/staff/receptionists", {
        name: name.trim(),
        contactPhone: contactPhone.trim(),
        ...(loginId.trim() ? { loginId: loginId.trim().toLowerCase() } : {}),
      });
      onCreated(res.credentials);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <Field
        label="Full name"
        name="name"
        required
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <Field
        label="Mobile (optional)"
        name="contactPhone"
        type="tel"
        value={contactPhone}
        onChange={(e) => setContactPhone(e.target.value)}
        error={errors.contactPhone}
      />
      <Field
        label="Login ID (optional)"
        name="loginId"
        autoCapitalize="none"
        placeholder="generated from the name"
        value={loginId}
        onChange={(e) => setLoginId(e.target.value)}
        error={errors.loginId}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Create login
        </Button>
      </div>
    </form>
  );
}
