"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BloodDisclaimer } from "@/components/blood/blood-bits";
import { ConfirmDialog } from "@/components/modal";
import { SitePage } from "@/components/site-header";
import { Alert, Badge, Button, Card, LoadingBlock } from "@/components/ui";
import { api } from "@/lib/api";
import { bloodLabel, formatWhen, useRequestKey } from "@/lib/blood";
import type { RequesterRequest, RequesterView } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

const STATUS_TEXT: Record<
  RequesterRequest["status"],
  { label: string; tone: "green" | "amber" | "red" | "slate" }
> = {
  OPEN: { label: "Open", tone: "amber" },
  FULFILLED: { label: "Blood found", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
  EXPIRED: { label: "Closed: time ran out", tone: "slate" },
};

/** The requester's page: who has said they can help, with a way to reach them while the request is open. */
export default function RequestStatusPage() {
  const { id } = useParams<{ id: string }>();
  const key = useRequestKey(id);
  const [closing, setClosing] = useState<"FULFILLED" | "CANCELLED" | null>(null);
  const { data, error, errorCode, reload } = useApi<RequesterView>(
    key ? "/blood/requests/" + id : null,
    {
      auth: false,
      headers: key ? { "X-Blood-Request-Key": key } : undefined,
    },
  );
  // The page updates by itself while it is open (and when the tab comes back into view).
  useAutoRefresh(reload, 10_000, !!key);
  const lost = errorCode === "REQUEST_NOT_FOUND";

  async function close(outcome: "FULFILLED" | "CANCELLED") {
    await api.post(
      "/blood/requests/" + id + "/close",
      { outcome },
      { auth: false, headers: { "X-Blood-Request-Key": key ?? "" } },
    );
    reload();
  }

  const noAccess = lost || key === null;
  const r = data?.request;
  const open = r?.status === "OPEN";

  return (
    <SitePage>
      <BloodDisclaimer />
      {noAccess && (
        <Card className="space-y-3">
          <h1 className="text-xl font-bold text-slate-900">
            This browser cannot open this request
          </h1>
          <p className="text-slate-600">
            Only the browser that made the request (or you, after proving your phone number again)
            can open it.
          </p>
          <Link
            href="/blood/request/find"
            className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Find my request
          </Link>
        </Card>
      )}
      {error && !lost && <Alert>{error}</Alert>}
      {!noAccess && !r && !error && <LoadingBlock />}

      {r && data && (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-red-600 text-2xl font-bold text-white">
                  {bloodLabel(r.bloodGroup)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {r.unitsNeeded} unit{r.unitsNeeded === 1 ? "" : "s"} needed
                  </h1>
                  <p className="text-slate-600">
                    {r.hospitalName}, {r.city}
                  </p>
                </div>
              </div>
              <Badge tone={STATUS_TEXT[r.status].tone}>{STATUS_TEXT[r.status].label}</Badge>
            </div>
            <p className="text-sm text-slate-600">
              We alerted {r.alertedDonors} donor{r.alertedDonors === 1 ? "" : "s"} and{" "}
              {r.alertedBanks} blood bank
              {r.alertedBanks === 1 ? "" : "s"} within {r.radiusKm} km.{" "}
              {open ? "This page closes itself at " + formatWhen(r.expiresAt) + "." : ""}
            </p>
            {open && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setClosing("FULFILLED")}>We found blood</Button>
                <Button variant="secondary" onClick={() => setClosing("CANCELLED")}>
                  Cancel the request
                </Button>
              </div>
            )}
          </Card>

          {open && data.donors.length + data.banks.length === 0 && (
            <Alert tone="info">
              Nobody has answered yet. This page updates by itself. While you wait, call the blood
              banks near you directly, and in an emergency call{" "}
              <a className="font-semibold underline" href="tel:112">
                112
              </a>
              .{" "}
              <Link href="/blood" className="font-semibold underline">
                See blood banks
              </Link>
            </Alert>
          )}

          {data.banks.length > 0 && (
            <section className="space-y-2" aria-label="Blood banks that can help">
              <h2 className="text-lg font-semibold text-slate-900">Blood banks that can help</h2>
              {data.banks.map((b) => (
                <Card
                  key={b.name + b.respondedAt}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{b.name}</div>
                    <div className="text-sm text-slate-600">{b.city}</div>
                  </div>
                  {b.phone ? (
                    <a
                      href={"tel:" + b.phone}
                      className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
                    >
                      Call {b.phone}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-500">Closed</span>
                  )}
                </Card>
              ))}
            </section>
          )}

          {data.donors.length > 0 && (
            <section className="space-y-2" aria-label="Donors who can help">
              <h2 className="text-lg font-semibold text-slate-900">
                Donors who said they can help
              </h2>
              {data.donors.map((d) => (
                <Card
                  key={d.firstName + d.respondedAt}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {d.firstName} <Badge tone="red">{bloodLabel(d.bloodGroup)}</Badge>
                    </div>
                    <div className="text-sm text-slate-600">
                      {d.distanceKm != null ? d.distanceKm.toFixed(1) + " km away · " : ""}
                      answered {formatWhen(d.respondedAt)}
                    </div>
                  </div>
                  {d.phone ? (
                    <a
                      href={"tel:" + d.phone}
                      className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
                    >
                      Call {d.phone}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-500">
                      Number hidden: the request is closed
                    </span>
                  )}
                </Card>
              ))}
              <p className="text-xs text-slate-500">
                A donor&apos;s number is shown only while the request is open. The blood bank or
                hospital must check the donor and the blood: MediQ does not.
              </p>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={closing !== null}
        title={closing === "FULFILLED" ? "Blood found?" : "Cancel this request?"}
        message={
          closing === "FULFILLED"
            ? "We will stop alerting people, and donors' numbers will disappear from this page."
            : "We will stop alerting people, and donors' numbers will disappear from this page."
        }
        confirmLabel={closing === "FULFILLED" ? "Yes, blood found" : "Cancel request"}
        danger={closing === "CANCELLED"}
        onConfirm={async () => {
          if (closing) await close(closing);
        }}
        onClose={() => setClosing(null)}
      />
    </SitePage>
  );
}
