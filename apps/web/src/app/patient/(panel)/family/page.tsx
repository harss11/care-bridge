"use client";

import { useState } from "react";
import { ConfirmDialog, Modal } from "@/components/modal";
import { ProfileForm, RELATION_LABEL } from "@/components/patient/profile-form";
import { Alert, Badge, Button, Card, LoadingBlock, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import type { PatientProfile } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function FamilyPage() {
  const { data, error, reload } = useApi<{ items: PatientProfile[] }>("/patient/profiles");
  const [editing, setEditing] = useState<PatientProfile | "new" | null>(null);
  const [removing, setRemoving] = useState<PatientProfile | null>(null);

  return (
    <>
      <PageHeader
        title="Family"
        subtitle="People you can book appointments for."
        actions={<Button onClick={() => setEditing("new")}>Add person</Button>}
      />
      {error && <Alert>{error}</Alert>}
      {!data && !error && <LoadingBlock />}
      {data && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{p.fullName}</span>
                    <Badge tone={p.relation === "SELF" ? "green" : "slate"}>
                      {RELATION_LABEL[p.relation]}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600">
                    {[p.dateOfBirth, p.gender && p.gender.toLowerCase(), p.phone]
                      .filter(Boolean)
                      .join(" · ") || "No other details"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="h-9 px-3" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  {p.relation !== "SELF" && (
                    <Button
                      variant="ghost"
                      className="h-9 px-3 text-red-700"
                      onClick={() => setRemoving(p)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Add person" : "Edit details"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <ProfileForm
            key={editing === "new" ? "new" : editing.id}
            profile={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.fullName ?? ""}?`}
        message="Their past appointments stay in your history. You can add them again later."
        danger
        confirmLabel="Remove"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await api.delete(`/patient/profiles/${removing!.id}`);
          reload();
        }}
      />
    </>
  );
}
