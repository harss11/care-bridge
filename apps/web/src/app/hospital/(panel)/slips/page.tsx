"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  Select,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { PAPER_PRESETS, defaultField } from "@/lib/slip-fields";
import type { SlipFieldKey, SlipTemplate } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const STARTER_FIELDS: SlipFieldKey[] = ["patientName", "patientAgeGender", "date", "tokenNumber"];

export default function SlipTemplatesPage() {
  const router = useRouter();
  const { data, error, reload } = useApi<{ items: SlipTemplate[] }>("/hospital/slip-templates");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("OPD slip");
  const [presetId, setPresetId] = useState<string>("a5");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SlipTemplate | null>(null);

  async function create() {
    const paper = PAPER_PRESETS.find((p) => p.id === presetId) ?? PAPER_PRESETS[0];
    setBusy(true);
    setFormError(null);
    try {
      const made = await api.post<SlipTemplate>("/hospital/slip-templates", {
        name: name.trim(),
        paperWidthMm: paper.w,
        paperHeightMm: paper.h,
        offsetXMm: 0,
        offsetYMm: 0,
        fields: STARTER_FIELDS.map((key, i) => defaultField(key, i, paper.w)),
      });
      router.push("/hospital/slips/" + made.id);
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Slip templates"
        subtitle="Design where patient details print on your pre-printed doctor slips."
        actions={<Button onClick={() => setCreating(true)}>New template</Button>}
      />
      {error && <Alert>{error}</Alert>}
      {!data && !error && <LoadingBlock />}
      {data && items.length === 0 && (
        <EmptyState title="No slip templates yet">
          Create one, then drag each detail onto its place on your paper.
        </EmptyState>
      )}
      {items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{t.name}</span>
                    {t.isDefault && <Badge tone="green">Default</Badge>}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t.paperWidthMm} × {t.paperHeightMm} mm · {t.fields.length} details
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={"/hospital/slips/" + t.id}
                    className="inline-flex h-9 items-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    Edit layout
                  </Link>
                  <Button
                    variant="ghost"
                    className="h-9 px-3 text-red-700 hover:bg-red-50"
                    onClick={() => setRemoving(t)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={creating}
        title="New slip template"
        onClose={() => (busy ? undefined : setCreating(false))}
      >
        <div className="space-y-4">
          <Field
            label="Name"
            name="new-name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select label="Paper size" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {PAPER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">
            You can change the size or use a custom size in the editor.
          </p>
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={name.trim().length < 2} onClick={create}>
              Create and edit
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        danger
        title="Delete this template?"
        message={
          removing
            ? "“" + removing.name + "” will be deleted. Reception will print with another template."
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (removing) await api.delete("/hospital/slip-templates/" + removing.id);
          reload();
        }}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
