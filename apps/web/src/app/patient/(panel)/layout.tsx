"use client";

import { RequireRole } from "@/components/auth-guards";
import { DashboardShell } from "@/components/dashboard-shell";
import { useT } from "@/lib/i18n";

/** Everything under /patient: signed-in patients only. Visitors are sent to log in, then brought back. */
export default function PatientPanelLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const nav = [
    { href: "/patient", label: t("nav.patient.home") },
    { href: "/patient/appointments", label: t("nav.patient.appointments") },
    { href: "/patient/waitlist", label: t("nav.patient.waitlist") },
    { href: "/patient/history", label: t("nav.patient.history") },
    { href: "/patient/family", label: t("nav.patient.family") },
    { href: "/patient/donor", label: t("nav.patient.donate") },
    { href: "/patient/privacy", label: t("nav.patient.privacy") },
  ];
  return (
    <RequireRole roles={["PATIENT"]} loginPath="/login">
      <DashboardShell nav={nav}>{children}</DashboardShell>
    </RequireRole>
  );
}
