"use client";

import { useState, type FormEvent } from "react";
import { ConfirmDialog, Modal } from "@/components/modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  Pagination,
  Textarea,
} from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { textOrNull } from "@/lib/format";
import type { Department, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function DepartmentsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<Department>>(
    `/hospital/departments?page=${page}&limit=50`,
  );
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Patients choose a department before picking a doctor."
        actions={<Button onClick={() => setEditing("new")}>Add department</Button>}
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState title="No departments yet">Add one, e.g. General Medicine.</EmptyState>
      )}
      {data && data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{d.name}</span>
                    {!d.isActive && <Badge>Hidden</Badge>}
                  </div>
                  <div className="text-sm text-slate-600">
                    {d.doctorCount} {d.doctorCount === 1 ? "doctor" : "doctors"}
                    {d.description && ` · ${d.description}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="h-9 px-3" onClick={() => setEditing(d)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 px-3 text-red-700"
                    onClick={() => setDeleting(d)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-5 py-3">
            <Pagination {...data.pagination} onPage={setPage} />
          </div>
        </Card>
      )}

      <DepartmentModal
        department={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="Only departments without doctors can be deleted. To hide a department instead, edit it and untick 'Visible to patients'."
        danger
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await api.delete(`/hospital/departments/${deleting!.id}`);
          reload();
        }}
      />
    </>
  );
}

function DepartmentModal({
  department,
  onClose,
  onSaved,
}: {
  department: Department | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = department && department !== "new" ? department : null;
  return (
    <Modal
      open={department !== null}
      title={existing ? "Edit department" : "Add department"}
      onClose={onClose}
    >
      {department !== null && (
        <DepartmentForm
          key={existing?.id ?? "new"}
          existing={existing}
          onSaved={onSaved}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}

function DepartmentForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing: Department | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const body = { name: name.trim(), description: textOrNull(description) };
    try {
      if (existing) await api.patch(`/hospital/departments/${existing.id}`, { ...body, isActive });
      else await api.post("/hospital/departments", body);
      onSaved();
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
        label="Name"
        name="name"
        required
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <Textarea
        label="Description (optional)"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />
      {existing && (
        <Checkbox label="Visible to patients" checked={isActive} onChange={setIsActive} />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}
