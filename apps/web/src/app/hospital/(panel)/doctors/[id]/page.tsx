"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { CredentialsModal } from "@/components/credentials-modal";
import { DoctorAvatar } from "@/components/hospital/doctor-avatar";
import { DoctorForm } from "@/components/hospital/doctor-form";
import { LeavesPanel } from "@/components/hospital/leaves-panel";
import { ScheduleEditor } from "@/components/hospital/schedule-editor";
import { SlotsPanel } from "@/components/hospital/slots-panel";
import { ConfirmDialog } from "@/components/modal";
import { Alert, Badge, Button, Card, LoadingBlock, PageHeader, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Credentials, Doctor, DoctorDetail, Hospital, StaffUser } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "schedule", label: "Timings" },
  { id: "leaves", label: "Leaves" },
  { id: "slots", label: "Slots" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function DoctorDetailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DoctorDetailView />
    </Suspense>
  );
}

function DoctorDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "profile") as Tab;
  const { data: doctor, error, setData, reload } = useApi<DoctorDetail>(`/hospital/doctors/${id}`);
  const hospital = useApi<Hospital>("/hospital/profile");
  const timezone = hospital.data?.timezone ?? "Asia/Kolkata";

  if (error) return <Alert>{error}</Alert>;
  if (!doctor) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        back={{ href: "/hospital/doctors", label: "Doctors" }}
        title={
          <span className="flex items-center gap-3">
            <DoctorAvatar doctor={doctor} />
            <span>{doctor.name}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{doctor.department?.name}</span>
            <span>· {formatMoney(doctor.consultationFee)}</span>
            {!doctor.isActive && <Badge>Inactive</Badge>}
          </span>
        }
      />

      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => router.replace(`/hospital/doctors/${id}?tab=${t.id}`)}
            className={cx(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
            {t.id === "schedule" && doctor.schedules.length === 0 && (
              <span
                className="ml-1 inline-block size-2 rounded-full bg-amber-500"
                aria-label="needs setup"
              />
            )}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <ProfileTab
          doctor={doctor}
          onChange={(d) => setData({ ...doctor, ...d })}
          onDeleted={() => router.replace("/hospital/doctors")}
          reload={reload}
        />
      )}
      {tab === "schedule" && (
        <ScheduleEditor
          doctorId={doctor.id}
          initial={doctor.schedules}
          onSaved={(schedules) => setData({ ...doctor, schedules })}
        />
      )}
      {tab === "leaves" && <LeavesPanel doctorId={doctor.id} timezone={timezone} />}
      {tab === "slots" && <SlotsPanel doctorId={doctor.id} timezone={timezone} />}
    </>
  );
}

function ProfileTab({
  doctor,
  onChange,
  onDeleted,
  reload,
}: {
  doctor: DoctorDetail;
  onChange: (d: Doctor) => void;
  onDeleted: () => void;
  reload: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function upload(file: File) {
    setPhotoError(null);
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Images must be 5 MB or smaller");
      return;
    }
    setPhotoBusy(true);
    try {
      onChange(await api.upload<Doctor>(`/hospital/doctors/${doctor.id}/photo`, "photo", file));
    } catch (err) {
      setPhotoError(errorMessage(err));
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      onChange(await api.delete<Doctor>(`/hospital/doctors/${doctor.id}/photo`));
    } catch (err) {
      setPhotoError(errorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function createLogin() {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await api.post<{ user: StaffUser; credentials: Credentials }>(
        `/hospital/doctors/${doctor.id}/login`,
        {},
      );
      setCredentials(res.credentials);
      reload();
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <DoctorAvatar doctor={doctor} size="lg" />
        <div className="flex-1 space-y-2">
          <h2 className="font-semibold text-slate-900">Photo</h2>
          <p className="text-sm text-slate-600">
            JPEG, PNG or WebP up to 5 MB. Cropped to a square around the face.
          </p>
          {photoError && <Alert>{photoError}</Alert>}
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <Button
              variant="secondary"
              loading={photoBusy}
              onClick={() => fileInput.current?.click()}
            >
              {doctor.photoUrl ? "Change photo" : "Upload photo"}
            </Button>
            {doctor.photoUrl && (
              <Button variant="ghost" disabled={photoBusy} onClick={removePhoto}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">Details</h2>
        {saved && <Alert tone="success">Saved.</Alert>}
        <DoctorForm
          key={doctor.isActive ? "active" : "inactive"}
          doctor={doctor}
          onSaved={(d) => {
            onChange(d);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          }}
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Doctor login (optional)</h2>
        {doctor.login ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span className="font-mono">{doctor.login.loginId}</span>
            {doctor.login.status === "BLOCKED" && <Badge tone="red">Blocked</Badge>}
            {doctor.login.mustChangePassword && <Badge tone="amber">Temp password</Badge>}
            <span className="text-slate-500">Reset or block it from the Staff page.</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Lets the doctor see today&apos;s queue and mark patients as done. You get a login ID
              and temporary password to hand over.
            </p>
            {loginError && <Alert>{loginError}</Alert>}
            <Button variant="secondary" loading={loginBusy} onClick={createLogin}>
              Create login
            </Button>
          </>
        )}
      </Card>

      <Card className="space-y-3 border-red-200">
        <h2 className="font-semibold text-red-800">Delete doctor</h2>
        <p className="text-sm text-slate-600">
          Only possible if the doctor has never had an appointment. Otherwise mark them inactive
          above.
        </p>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete doctor
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${doctor.name}?`}
        message="This removes the doctor, their timings, leaves and slots. Their login (if any) is blocked."
        danger
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await api.delete(`/hospital/doctors/${doctor.id}`);
          onDeleted();
        }}
      />
      <CredentialsModal
        title="Doctor login created"
        credentials={credentials}
        onClose={() => setCredentials(null)}
      />
    </div>
  );
}
