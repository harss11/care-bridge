"use client";

import { useState } from "react";
import { BloodDisclaimer } from "@/components/blood/blood-bits";
import { Alert, Badge, Button, Card, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { bloodLabel, formatWhen } from "@/lib/blood";
import type { OwnBloodBank, ResponderRequest } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

export default function BloodBankOverviewPage() {
  const bank = useApi<OwnBloodBank>("/blood-bank/profile");
  const requests = useApi<{ items: ResponderRequest[] }>("/blood-bank/requests");
  useAutoRefresh(requests.reload, 15_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = bank.data?.status === "ACTIVE";

  async function answer(id: string, response: "CAN_HELP" | "CANNOT") {
    setBusy(id);
    setError(null);
    try {
      await api.post("/blood-bank/requests/" + id + "/respond", { response });
      requests.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title={bank.data?.name ?? "Blood bank"}
        subtitle="Emergency requests near you, and your day's work."
      />
      <BloodDisclaimer />
      {error && <Alert>{error}</Alert>}

      <section className="space-y-3" aria-label="Open emergency requests">
        <h2 className="text-lg font-semibold text-slate-900">Open emergency requests near you</h2>
        {!requests.data && !requests.error && <LoadingBlock />}
        {requests.error && <Alert>{requests.error}</Alert>}
        {requests.data && requests.data.items.length === 0 && (
          <EmptyState title="No open requests">
            When someone asks for blood near you, it appears here and you get an SMS. This page
            updates by itself.
          </EmptyState>
        )}
        {requests.data?.items.map((r) => (
          <Card key={r.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-red-600 text-lg font-bold text-white">
                  {bloodLabel(r.bloodGroup)}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {r.unitsNeeded} unit{r.unitsNeeded === 1 ? "" : "s"} at {r.hospitalName}
                  </div>
                  <div className="text-sm text-slate-600">
                    {r.city}
                    {r.distanceKm != null ? " · " + r.distanceKm.toFixed(1) + " km" : ""} · asked by{" "}
                    {r.requesterFirstName}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.urgency === "EMERGENCY" && <Badge tone="red">Emergency</Badge>}
                {r.myResponse === "CAN_HELP" && <Badge tone="green">You said you can help</Badge>}
                {r.myResponse === "CANNOT" && <Badge tone="slate">You said you cannot</Badge>}
              </div>
            </div>
            {r.note && <p className="text-sm text-slate-700">“{r.note}”</p>}
            <p className="text-xs text-slate-500">Closes {formatWhen(r.expiresAt)}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-10"
                loading={busy === r.id}
                disabled={!active || r.myResponse === "CAN_HELP"}
                onClick={() => answer(r.id, "CAN_HELP")}
              >
                We can help
              </Button>
              <Button
                variant="secondary"
                className="h-10"
                disabled={!active || busy === r.id || r.myResponse === "CANNOT"}
                onClick={() => answer(r.id, "CANNOT")}
              >
                We cannot
              </Button>
            </div>
            {!active && (
              <p className="text-xs text-slate-500">
                You can answer once Care Bridge has verified your blood bank.
              </p>
            )}
          </Card>
        ))}
        <p className="text-xs text-slate-500">
          If you say you can help, the person who asked sees your blood bank&apos;s public phone
          number. Check the patient and the hospital yourself: availability and safety are your
          responsibility.
        </p>
      </section>
    </>
  );
}
