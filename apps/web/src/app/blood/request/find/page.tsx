"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PhoneCodeFields, usePhoneCode } from "@/components/blood/phone-code";
import { SitePage } from "@/components/site-header";
import { Alert, Button, Card } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { bloodLabel, saveRequestKey } from "@/lib/blood";
import type { RequesterRequest } from "@/lib/types";

/**
 * Gets a requester back into their open requests after proving the phone number again. Each
 * request gets a new secret key (the old one stops working), saved in this browser only.
 */
export default function FindMyRequestPage() {
  const phone = usePhoneCode("RECOVERY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<RequesterRequest[] | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ items: Array<RequesterRequest & { key: string }> }>(
        "/blood/requests/recover",
        { phone: phone.phone, code: phone.code },
        { auth: false },
      );
      for (const item of res.items) saveRequestKey(item.id, item.key);
      setFound(res.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SitePage>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Find my request</h1>
        <p className="mt-1 text-slate-600">
          Enter the number you used when you asked for blood. We send a code, then open your request
          on this device.
        </p>
      </div>
      {found === null ? (
        <form onSubmit={submit} noValidate>
          <Card className="space-y-4">
            <PhoneCodeFields state={phone} />
            {error && <Alert>{error}</Alert>}
            <Button type="submit" loading={busy} disabled={!phone.sent || phone.code.length !== 6}>
              Find my request
            </Button>
          </Card>
        </form>
      ) : found.length === 0 ? (
        <Alert tone="info">
          There is no open request for this number. Requests close by themselves after a day.{" "}
          <Link href="/blood/request" className="font-semibold underline">
            Ask for blood
          </Link>
        </Alert>
      ) : (
        <ul className="space-y-3">
          {found.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold text-slate-900">
                    {bloodLabel(r.bloodGroup)} · {r.unitsNeeded} unit
                    {r.unitsNeeded === 1 ? "" : "s"}
                  </div>
                  <div className="text-sm text-slate-600">
                    {r.hospitalName}, {r.city}
                  </div>
                </div>
                <Link
                  href={"/blood/request/" + r.id}
                  className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Open
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </SitePage>
  );
}
