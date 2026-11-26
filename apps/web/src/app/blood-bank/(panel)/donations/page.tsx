"use client";

import { useState, type FormEvent } from "react";
import { BloodGroupSelect } from "@/components/blood/blood-bits";
import { Modal } from "@/components/modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
  Textarea,
} from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { bloodLabel, formatWhen } from "@/lib/blood";
import type { BankDonation, BloodGroup, DonorLookup, Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const REASONS: Record<string, string> = {
  TOO_YOUNG: "is under the minimum age",
  TOO_OLD: "is over the maximum age",
  WAITING_PERIOD: "is still in the waiting period after the last donation",
};

export default function DonationsPage() {
  const [page, setPage] = useState(1);
  const list = useApi<Paginated<BankDonation>>("/blood-bank/donations?limit=20&page=" + page);
  const [voiding, setVoiding] = useState<BankDonation | null>(null);

  return (
    <>
      <PageHeader
        title="Donations"
        subtitle="Only blood bank staff record donations. Find the donor by phone, check the blood group with your own test, then record it."
      />
      <RecordDonation onRecorded={list.reload} />

      <section className="space-y-3" aria-label="Recent donations">
        <h2 className="text-lg font-semibold text-slate-900">Recorded by your blood bank</h2>
        {list.error && <Alert>{list.error}</Alert>}
        {!list.data && !list.error && <LoadingBlock />}
        {list.data && list.data.items.length === 0 && (
          <EmptyState title="No donations recorded yet" />
        )}
        {list.data && list.data.items.length > 0 && (
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {list.data.items.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{d.donorName}</span>
                      <Badge tone="red">{bloodLabel(d.bloodGroup)}</Badge>
                      {d.voided && <Badge tone="slate">Voided</Badge>}
                    </div>
                    <div className="text-sm text-slate-600">
                      {formatWhen(d.donatedAt)} · {d.volumeMl} ml ·{" "}
                      {d.donorPhone ?? "number removed"} · by {d.recordedBy}
                      {d.voided && d.voidReason ? " · " + d.voidReason : ""}
                    </div>
                  </div>
                  {d.canVoid && (
                    <Button
                      variant="ghost"
                      className="h-9 px-3 text-red-700 hover:bg-red-50"
                      onClick={() => setVoiding(d)}
                    >
                      Void
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-5 py-3">
              <Pagination {...list.data.pagination} onPage={setPage} />
            </div>
          </Card>
        )}
      </section>

      <VoidDialog donation={voiding} onClose={() => setVoiding(null)} onDone={list.reload} />
    </>
  );
}

function RecordDonation({ onRecorded }: { onRecorded: () => void }) {
  const [phone, setPhone] = useState("");
  const [donor, setDonor] = useState<DonorLookup | null>(null);
  const [group, setGroup] = useState<BloodGroup | "">("");
  const [volume, setVolume] = useState("350");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  async function find(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setDonor(null);
    try {
      const found = await api.get<DonorLookup>(
        "/blood-bank/donors/lookup?phone=" + encodeURIComponent(phone.trim()),
      );
      setDonor(found);
      setGroup(found.bloodGroup);
    } catch (err) {
      setMessage({
        tone: err instanceof ApiError && err.status === 404 ? "info" : "error",
        text: errorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  }

  async function record() {
    if (!donor || !group) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.post<{ nextEligibleAt: string }>("/blood-bank/donations", {
        donorId: donor.donorId,
        bloodGroup: group,
        volumeMl: Number(volume),
      });
      setMessage({
        tone: "success",
        text:
          "Recorded. " +
          donor.name +
          " can donate again from " +
          formatWhen(res.nextEligibleAt).split(",")[0] +
          ". They have been sent an SMS.",
      });
      setDonor(null);
      setPhone("");
      onRecorded();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-slate-900">Record a donation</h2>
      <form onSubmit={find} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <Field
          className="flex-1"
          label="Donor's mobile number"
          name="donor-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="98765 43210"
          hint="The donor must have registered as a donor in the Care Bridge app."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={busy && !donor}
          disabled={phone.trim().length < 8}
        >
          Find donor
        </Button>
      </form>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {donor && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">{donor.name}</div>
            <div className="text-sm text-slate-600">
              {donor.ageYears != null ? donor.ageYears + " years · " : ""}
              says {bloodLabel(donor.bloodGroup)}
              {donor.lastDonationAt
                ? " · last donated " + formatWhen(donor.lastDonationAt).split(",")[0]
                : " · first donation"}
            </div>
          </div>
          {!donor.eligible ? (
            <Alert>
              This donor cannot donate now: they{" "}
              {donor.ineligibleReasons.map((r) => REASONS[r]).join(" and ")}
              {donor.nextEligibleAt
                ? ". They can donate from " + formatWhen(donor.nextEligibleAt).split(",")[0] + "."
                : "."}
            </Alert>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <BloodGroupSelect
                  label="Blood group (from your test)"
                  value={group}
                  onChange={setGroup}
                />
                <Select label="Volume" value={volume} onChange={(e) => setVolume(e.target.value)}>
                  <option value="350">350 ml</option>
                  <option value="450">450 ml</option>
                </Select>
              </div>
              <p className="text-xs text-slate-500">
                The group you enter replaces what the donor said, and cannot then be changed by the
                donor. Screening and safety are the blood bank&apos;s responsibility.
              </p>
              <Button loading={busy} disabled={!group} onClick={record}>
                Record the donation
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function VoidDialog({
  donation,
  onClose,
  onDone,
}: {
  donation: BankDonation | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={!!donation} title="Void this donation?" onClose={onClose}>
      {donation && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Use this only for a donation recorded by mistake (within 48 hours). The donor&apos;s
            waiting period is worked out again from their earlier donations.
          </p>
          <Textarea
            label="What went wrong?"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <VoidActions
            donation={donation}
            reason={reason}
            onClose={() => {
              setReason("");
              onClose();
            }}
            onDone={onDone}
          />
        </div>
      )}
    </Modal>
  );
}

function VoidActions({
  donation,
  reason,
  onClose,
  onDone,
}: {
  donation: BankDonation;
  reason: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/blood-bank/donations/" + donation.id + "/void", { reason: reason.trim() });
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Keep it
        </Button>
        <Button
          variant="danger"
          loading={busy}
          disabled={reason.trim().length < 5}
          onClick={submit}
        >
          Void donation
        </Button>
      </div>
    </>
  );
}
