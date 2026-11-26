"use client";

import { useState } from "react";
import { FreshnessNote } from "@/components/blood/blood-bits";
import { Alert, Button, Card, LoadingBlock, PageHeader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { bloodLabel, formatWhen } from "@/lib/blood";
import type { BloodGroup, BloodStockRow } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Units on the shelf per blood group. The public sees these, with how old they are. */
export default function StockPage() {
  const { data, error, reload } = useApi<{ items: BloodStockRow[] }>("/blood-bank/stock");
  const [edited, setEdited] = useState<Partial<Record<BloodGroup, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const rows = data?.items ?? [];
  const valueOf = (r: BloodStockRow) => edited[r.bloodGroup] ?? String(r.units);
  const invalid = rows.some((r) => !/^\d{1,4}$/.test(valueOf(r)));
  const changed = rows.filter(
    (r) => edited[r.bloodGroup] !== undefined && edited[r.bloodGroup] !== String(r.units),
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api.put("/blood-bank/stock", {
        items: changed.map((r) => ({
          bloodGroup: r.bloodGroup,
          units: Number(edited[r.bloodGroup]),
        })),
      });
      setEdited({});
      reload();
      setMessage({ tone: "success", text: "Stock saved. Patients now see these numbers." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const latest = rows.reduce<string | null>(
    (l, r) => (r.updatedAt && (!l || r.updatedAt > l) ? r.updatedAt : l),
    null,
  );

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Update the units on your shelf. Keep it current: old figures are shown to patients as a guess."
      />
      {error && <Alert>{error}</Alert>}
      {!data && !error && <LoadingBlock />}
      {data && (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rows.map((r) => (
              <label key={r.bloodGroup} className="block rounded-xl border border-slate-200 p-3">
                <span className="text-lg font-bold text-slate-900">{bloodLabel(r.bloodGroup)}</span>
                <input
                  inputMode="numeric"
                  aria-label={"Units of " + bloodLabel(r.bloodGroup)}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-lg font-semibold tabular-nums"
                  value={valueOf(r)}
                  onChange={(e) =>
                    setEdited({
                      ...edited,
                      [r.bloodGroup]: e.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                    })
                  }
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {r.updatedAt ? "Updated " + formatWhen(r.updatedAt) : "Not reported yet"}
                </span>
              </label>
            ))}
          </div>
          <FreshnessNote updatedAt={latest} stale={rows.every((r) => r.stale)} />
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button loading={busy} disabled={changed.length === 0 || invalid} onClick={save}>
              Save{" "}
              {changed.length > 0
                ? changed.length + " change" + (changed.length === 1 ? "" : "s")
                : "changes"}
            </Button>
            {changed.length > 0 && (
              <Button variant="ghost" onClick={() => setEdited({})}>
                Undo
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
