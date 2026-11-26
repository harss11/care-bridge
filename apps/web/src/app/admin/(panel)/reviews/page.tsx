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
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AdminReviewRow, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Filter = "reported" | "hidden" | "all";

/** Reviews hospitals have reported, and the ones already hidden. Hide, restore or keep. */
export default function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Filter>("reported");
  const { data, error, loading, reload } = useApi<Paginated<AdminReviewRow>>(
    `/admin/reviews?page=${page}&limit=20&status=${status}`,
  );
  const [hiding, setHiding] = useState<AdminReviewRow | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(r: AdminReviewRow, action: "unhide" | "dismiss") {
    setActionError(null);
    try {
      await api.post(`/admin/reviews/${r.id}/${action}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Hide a review only when it breaks the rules: abuse, personal details, advertising, or not a real patient."
        actions={
          <Select
            label="Show"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Filter);
              setPage(1);
            }}
          >
            <option value="reported">Reported</option>
            <option value="hidden">Hidden</option>
            <option value="all">All</option>
          </Select>
        }
      />
      {error && <Alert>{error}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      {loading && !data && <LoadingBlock />}
      {data && data.items.length === 0 && <EmptyState title="Nothing here" />}
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
                      {r.hiddenAt && <Badge tone="red">Hidden</Badge>}
                      <span className="text-xs text-slate-500">
                        {formatDate(r.createdAt.slice(0, 10))}
                      </span>
                    </div>
                  </div>
                  {r.comment && <p className="whitespace-pre-line text-slate-800">{r.comment}</p>}
                  <p className="text-xs text-slate-500">
                    {r.reviewer} · about {r.doctor} at {r.hospital}
                  </p>
                  {r.reportReason && (
                    <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                      Hospital says: {r.reportReason}
                    </p>
                  )}
                  {r.hiddenReason && (
                    <p className="text-sm text-slate-600">Hidden because: {r.hiddenReason}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!r.hiddenAt && (
                      <Button
                        variant="secondary"
                        className="h-9 px-3 text-red-700"
                        onClick={() => {
                          setReason("");
                          setHiding(r);
                        }}
                      >
                        Hide
                      </Button>
                    )}
                    {r.hiddenAt && (
                      <Button
                        variant="secondary"
                        className="h-9 px-3"
                        onClick={() => void act(r, "unhide")}
                      >
                        Publish again
                      </Button>
                    )}
                    {r.reportedAt && !r.hiddenAt && (
                      <Button
                        variant="ghost"
                        className="h-9 px-3"
                        onClick={() => void act(r, "dismiss")}
                      >
                        Keep it (dismiss report)
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination {...data.pagination} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={hiding !== null}
        title="Hide this review?"
        message="It leaves the public ratings straight away and the patient can no longer change it."
        danger
        confirmLabel="Hide review"
        onClose={() => setHiding(null)}
        onConfirm={async () => {
          await api.post(`/admin/reviews/${hiding!.id}/hide`, { reason: reason.trim() });
          setHiding(null);
          reload();
        }}
      >
        <Textarea
          label="Reason (kept in the audit log)"
          name="reason"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </>
  );
}
