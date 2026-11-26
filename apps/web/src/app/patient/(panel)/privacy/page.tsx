"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, PageHeader } from "@/components/ui";
import { ApiError, api, applySession, errorMessage } from "@/lib/api";

export default function PrivacyAndDataPage() {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [erasing, setErasing] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const data = await api.get<unknown>("/patient/account/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mediq-my-data-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setDownloadError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  async function erase() {
    setErasing(true);
    setEraseError(null);
    try {
      await api.post("/patient/account/erase", { confirm });
      // The server has ended every session; clear this tab's too and go home.
      applySession(null);
      router.replace("/?erased=1");
    } catch (err) {
      setEraseError(
        err instanceof ApiError && err.code === "VALIDATION_ERROR"
          ? "Type ERASE in capital letters to confirm."
          : errorMessage(err),
      );
      setErasing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Privacy and data"
        subtitle="Your data, your choice."
        back={{ href: "/patient", label: "Home" }}
      />

      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Download a copy of my data</h2>
        <p className="text-sm text-slate-600">
          A file with your account, family profiles, appointments, payments and the policies you
          accepted.
        </p>
        {downloadError && <Alert>{downloadError}</Alert>}
        <Button variant="secondary" loading={downloading} onClick={download}>
          Download my data
        </Button>
      </Card>

      <Card className="space-y-4 border-red-200">
        <div className="space-y-2">
          <h2 className="font-semibold text-slate-900">Erase my account</h2>
          <p className="text-sm text-slate-600">This cannot be undone.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Your name, phone number, date of birth, family profiles and messages are removed.
            </li>
            <li>You are signed out on every device.</li>
            <li>
              The hospital keeps the record of each visit, its fee and the payment, without your
              personal details, because the hospital and the law require it.
            </li>
            <li>You can start again later with the same phone number as a new account.</li>
            <li>
              You cannot erase while you have an upcoming appointment or a refund on its way: cancel
              first and wait for the refund.
            </li>
          </ul>
        </div>
        <Field
          label="Type ERASE to confirm"
          name="confirm"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {eraseError && <Alert>{eraseError}</Alert>}
        <Button variant="danger" loading={erasing} disabled={confirm !== "ERASE"} onClick={erase}>
          Erase my account
        </Button>
      </Card>

      <p className="text-sm text-slate-600">
        Read the{" "}
        <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
          privacy policy
        </Link>{" "}
        and the{" "}
        <Link href="/terms" className="font-medium text-brand-700 hover:underline">
          terms
        </Link>
        .
      </p>
    </>
  );
}
