"use client";

import { useState } from "react";
import { RatingLine } from "@/components/reviews/stars";
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
  Select,
  Textarea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { HospitalReviewRow, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** What patients said about this hospital. A hospital cannot hide a review, only report it to MediQ. */
export default function HospitalReviewsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "reported">("all");
  const { data, error, loading, reload } = useApi<Paginated<HospitalReviewRow>>(
    `/hospital/reviews?page=${page}&limit=20&status=${status}`,
  );
  const [reporting, setReporting] = useState<HospitalReviewRow | null>(null);
  const [reason, setReason] = useState("");

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Patients can rate a visit after they have been seen. Names show as first name and initial."
        actions={
          <Select
            label="Show"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "all" | "reported");
              setPage(1);
            }}
          >
            <option value="all">All reviews</option>
            <option value="reported">Reported by us</option>
          </Select>
        }
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState
          title={status === "reported" ? "You have not reported any review" : "No reviews yet"}
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className={loading ? "space-y-3 opacity-60" : "space-y-3"}>
            {data.items.map((r) => (
              <li key={r.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <RatingLine rating={{ average: r.rating, count: 1 }} single />
                    <div className="flex items-center gap-2">
                      {r.reportedAt && <Badge tone="amber">Reported</Badge>}
                      {!r.isPublished && <Badge tone="red">Hidden by MediQ</Badge>}
                      <span className="text-xs text-slate-500">
                        {formatDate(r.createdAt.slice(0, 10))}
                      </span>
                    </div>
                  </div>
                  {r.comment && <p className="whitespace-pre-line text-slate-800">{r.comment}</p>}
                  <p className="text-xs text-slate-500">
                    {r.reviewer} · about {r.doctor}
                  </p>
                  {r.reportReason && (
                    <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                      Your report: {r.reportReason}
                    </p>
                  )}
                  {r.hiddenReason && (
                    <p className="text-sm text-slate-600">MediQ: {r.hiddenReason}</p>
                  )}
                  {!r.reportedAt && r.isPublished && (
                    <Button
                      variant="ghost"
                      className="h-9 px-3"
                      onClick={() => {
                        setReason("");
                        setReporting(r);
                      }}
                    >
                      Report this review
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          <Pagination {...data.pagination} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={reporting !== null}
        title="Report this review to MediQ?"
        message="MediQ checks it against the review rules (not a patient, abuse, personal details, advertising). A review is not removed because it is a bad one."
        confirmLabel="Send report"
        onClose={() => setReporting(null)}
        onConfirm={async () => {
          await api.post(`/hospital/reviews/${reporting!.id}/report`, { reason: reason.trim() });
          setReporting(null);
          reload();
        }}
      >
        <Textarea
          label="What is wrong with it?"
          name="reason"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </>
  );
}
