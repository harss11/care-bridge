"use client";

import Link from "next/link";
import { useState } from "react";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { ConfirmDialog } from "@/components/modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Pagination,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Paginated, WaitlistEntry, WaitlistStatus } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

const TONE: Record<WaitlistStatus, "green" | "slate" | "blue"> = {
  WAITING: "blue",
  NOTIFIED: "green",
  BOOKED: "slate",
  EXPIRED: "slate",
  CANCELLED: "slate",
};

/** The days I am waiting for, my place in the line, and a way to leave. */
export default function MyWaitlistPage() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<"active" | "all">("active");
  const { data, error, loading, reload } = useApi<Paginated<WaitlistEntry>>(
    `/waitlist?scope=${scope}&page=${page}&limit=20`,
  );
  useAutoRefresh(reload, 60_000);
  const [leaving, setLeaving] = useState<WaitlistEntry | null>(null);

  return (
    <>
      <PageHeader
        title={t("waitlist.title")}
        subtitle={t("waitlist.subtitle")}
        actions={
          <Button
            variant="secondary"
            className="h-10"
            onClick={() => {
              setScope(scope === "active" ? "all" : "active");
              setPage(1);
            }}
          >
            {scope === "active" ? t("waitlist.showEarlier") : t("waitlist.showCurrent")}
          </Button>
        }
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState title={scope === "active" ? t("waitlist.emptyActive") : t("waitlist.emptyAll")}>
          {t("waitlist.emptyText")}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((e) => {
              const live = e.status === "WAITING" || e.status === "NOTIFIED";
              return (
                <li key={e.id}>
                  <Card className="space-y-3 p-4">
                    <div className="flex items-start gap-4">
                      <DoctorAvatar doctor={e.doctor} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{e.doctor.name}</span>
                          <Badge tone={TONE[e.status]}>{t(`waitlist.status.${e.status}`)}</Badge>
                        </div>
                        <div className="text-sm text-slate-600">
                          {e.hospital.name} · {formatDate(e.date)} ·{" "}
                          {t("waitlist.for", { name: e.patient.fullName })}
                        </div>
                        {e.status === "WAITING" && e.position !== null && (
                          <div className="text-sm text-slate-600">
                            {t("waitlist.place", { n: e.position })}
                          </div>
                        )}
                      </div>
                    </div>
                    {e.status === "NOTIFIED" && (
                      <Alert tone="info">
                        {e.noticeEndsAt
                          ? t("waitlist.notifiedUntil", {
                              time: formatTime(e.noticeEndsAt, e.hospital.timezone),
                            })
                          : t("waitlist.notified")}
                      </Alert>
                    )}
                    {live && (
                      <div className="flex flex-wrap gap-2">
                        {e.seatsOpen && (
                          <Link
                            href={`/doctors/${e.doctor.id}`}
                            className="inline-flex h-10 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
                          >
                            {t("waitlist.book")}
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          className="h-10 text-red-700"
                          onClick={() => setLeaving(e)}
                        >
                          {t("waitlist.leave")}
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          <Pagination {...data.pagination} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={leaving !== null}
        title={t("waitlist.leaveTitle")}
        message={t("waitlist.leaveText")}
        danger
        confirmLabel={t("waitlist.leave")}
        onClose={() => setLeaving(null)}
        onConfirm={async () => {
          await api.delete(`/waitlist/${leaving!.id}`);
          setLeaving(null);
          reload();
        }}
      />
    </>
  );
}
