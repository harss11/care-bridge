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
} from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { Credentials, StaffUser } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Pending = { kind: "reset" | "block" | "unblock"; user: StaffUser } | null;

/** Logins of everyone who works at this blood bank. Each person should have their own. */
export default function BloodBankStaffPage() {
  const { user: me } = useAuth();
  const { data, error, reload } = useApi<{ items: StaffUser[] }>("/blood-bank/staff");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [credentials, setCredentials] = useState<{ title: string; value: Credentials } | null>(
    null,
  );

  return (
    <>
      <PageHeader
        title="Staff logins"
        subtitle="Give each person their own login: donations and stock changes are recorded against who made them."
        actions={<Button onClick={() => setAdding(true)}>Add a colleague</Button>}
      />
      {error && <Alert>{error}</Alert>}
      {!data && !error && <LoadingBlock />}
      {data && data.items.length === 0 && <EmptyState title="No staff yet" />}
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
                    {u.id === me?.id && <Badge tone="blue">You</Badge>}
                    {u.status === "BLOCKED" && <Badge tone="red">Blocked</Badge>}
                    {u.mustChangePassword && <Badge tone="amber">Temp password</Badge>}
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-mono">{u.loginId}</span>
                    {" · last login " + (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "never")}
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
                  {u.id !== me?.id &&
                    (u.status === "ACTIVE" ? (
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
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={adding} title="Add a colleague" onClose={() => setAdding(false)}>
        {adding && (
          <AddForm
            onCancel={() => setAdding(false)}
            onCreated={(c) => {
              setAdding(false);
              setCredentials({ title: "Login created", value: c });
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={pending?.kind === "reset"}
        title={"Reset password for " + (pending?.user.name ?? "") + "?"}
        message="They are signed out everywhere and must set a new password at next login."
        confirmLabel="Reset password"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const res = await api.post<{ credentials: Credentials }>(
            "/blood-bank/staff/" + pending!.user.id + "/reset-password",
          );
          setCredentials({ title: "New temporary password", value: res.credentials });
          reload();
        }}
      />
      <ConfirmDialog
        open={pending?.kind === "block"}
        title={"Block " + (pending?.user.name ?? "") + "?"}
        message="They are signed out immediately and cannot log in until unblocked."
        danger
        confirmLabel="Block"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          await api.post("/blood-bank/staff/" + pending!.user.id + "/block");
          reload();
        }}
      />
      <ConfirmDialog
        open={pending?.kind === "unblock"}
        title={"Unblock " + (pending?.user.name ?? "") + "?"}
        message="They can log in again with their current password."
        confirmLabel="Unblock"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          await api.post("/blood-bank/staff/" + pending!.user.id + "/unblock");
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

function AddForm({
  onCreated,
  onCancel,
}: {
  onCreated: (c: Credentials) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await api.post<{ credentials: Credentials }>("/blood-bank/staff", {
        name: name.trim(),
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
      <Field
        label="Name"
        name="name"
        value={name}
        error={errors.name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label="Login ID (optional)"
        name="loginId"
        hint="Leave empty and we suggest one."
        value={loginId}
        error={errors.loginId}
        onChange={(e) => setLoginId(e.target.value)}
        autoCapitalize="none"
      />
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={name.trim().length < 2}>
          Create login
        </Button>
      </div>
    </form>
  );
}
