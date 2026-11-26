"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Card, Field, LoadingBlock, Logo } from "@/components/ui";
import type { PublicQueue, QueueState } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

export default function LiveQueuePage() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
          <Logo />
          <span className="text-sm text-slate-500">Live queue</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <Suspense fallback={<LoadingBlock />}>
          <LiveQueue />
        </Suspense>
      </main>
    </div>
  );
}

const STATE_TEXT: Record<QueueState, string> = {
  NO_BOOKINGS: "No appointments are booked for today yet.",
  NOT_STARTED: "The doctor has not started seeing patients yet.",
  SERVING: "A patient is with the doctor now.",
  BETWEEN: "The next patient will be called shortly.",
  DONE: "Today’s queue is finished.",
};

/** A token typed or linked by the visitor, kept only if it is a positive whole number. */
function parseToken(raw: string | null): number | null {
  if (!raw || !/^\d{1,5}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

function LiveQueue() {
  const { token } = useParams<{ token: string }>();
  const initial = parseToken(useSearchParams().get("token"));
  const [mine, setMine] = useState<number | null>(initial);
  const [typed, setTyped] = useState(initial ? String(initial) : "");
  const path = "/public/queue/" + encodeURIComponent(token) + (mine ? "?token=" + mine : "");
  const { data, error, reload } = useApi<PublicQueue>(path);
  useAutoRefresh(reload, 5_000);

  function changeToken(value: string) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 5);
    setTyped(digits);
    const n = parseToken(digits);
    setMine(n);
    // Keep the link shareable and survive a page refresh.
    const url = new URL(window.location.href);
    if (n) url.searchParams.set("token", String(n));
    else url.searchParams.delete("token");
    window.history.replaceState(null, "", url);
  }

  if (error && !data) {
    return (
      <Card className="space-y-3 text-center">
        <h1 className="text-xl font-bold text-slate-900">Queue not found</h1>
        <p className="text-slate-600">{error}</p>
        <Link href="/hospitals" className="font-semibold text-brand-800 hover:underline">
          Find a hospital
        </Link>
      </Card>
    );
  }
  if (!data) return <LoadingBlock />;

  const you = data.yourToken;
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{data.doctor.name}</h1>
        <p className="text-slate-600">
          {data.doctor.department} · {data.hospital.name}
        </p>
      </div>

      <Card className="space-y-2 text-center">
        <div className="text-sm font-medium text-slate-500">Now serving</div>
        <div
          className="text-8xl leading-none font-bold text-brand-700 tabular-nums"
          aria-live="polite"
          aria-label={data.nowServing ? "Token " + data.nowServing : "Nobody yet"}
        >
          {data.nowServing ?? "–"}
        </div>
        <p className="text-slate-600">{STATE_TEXT[data.state]}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-sm">
          <div>
            <dt className="text-slate-500">Waiting</dt>
            <dd className="text-xl font-bold text-slate-900 tabular-nums">
              {data.counts.waiting + data.counts.booked}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Seen</dt>
            <dd className="text-xl font-bold text-slate-900 tabular-nums">
              {data.counts.completed}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Last token</dt>
            <dd className="text-xl font-bold text-slate-900 tabular-nums">{data.lastIssued}</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-3">
        <Field
          label="Your token number"
          name="my-token"
          inputMode="numeric"
          placeholder="e.g. 12"
          hint="Enter it to see how long you may wait."
          value={typed}
          onChange={(e) => changeToken(e.target.value)}
        />
        {you && <YourToken you={you} />}
      </Card>

      <p className="text-center text-xs text-slate-500">
        Updates by itself every few seconds · last updated{" "}
        {new Date(data.generatedAt).toLocaleTimeString("en-IN", { timeStyle: "short" })} · waits are
        estimates
      </p>
    </>
  );
}

function YourToken({ you }: { you: NonNullable<PublicQueue["yourToken"]> }) {
  if (you.status === "NOW") {
    return <Alert tone="success">It is your turn. Please go in to the doctor.</Alert>;
  }
  if (you.status === "DONE") return <Alert tone="info">Your consultation is complete.</Alert>;
  if (you.status === "MISSED") {
    return <Alert>This token was marked as not arrived. Please speak to reception.</Alert>;
  }
  if (you.status === "NOT_FOUND") {
    return <Alert tone="info">Token {you.token} has not been issued for today.</Alert>;
  }
  return (
    <Alert tone="info">
      {you.ahead === 0 ? (
        <strong>You are next.</strong>
      ) : (
        <>
          <strong>
            {you.ahead} {you.ahead === 1 ? "patient is" : "patients are"} ahead of you
          </strong>
          {" · about "}
          <strong>{you.minutes} min</strong>
        </>
      )}
    </Alert>
  );
}
