"use client";

import { RequireRole } from "@/components/auth-guards";
import { DashboardShell } from "@/components/dashboard-shell";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { Alert } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { SubscriptionView } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const NAV = [
  { href: "/hospital", label: "Overview" },
  { href: "/hospital/doctors", label: "Doctors" },
  { href: "/hospital/departments", label: "Departments" },
  { href: "/hospital/staff", label: "Staff" },
  { href: "/hospital/analytics", label: "Analytics" },
  { href: "/hospital/reviews", label: "Reviews" },
  { href: "/hospital/slips", label: "Slips" },
  { href: "/hospital/qr", label: "QR codes" },
  { href: "/hospital/subscription", label: "Plan" },
  { href: "/hospital/settings", label: "Settings" },
];

function PendingBanner() {
  const { user } = useAuth();
  if (user?.hospital?.status !== "PENDING_APPROVAL") return null;
  return (
    <Alert tone="info">
      Your hospital is awaiting approval by MediQ. You can set up departments, doctors and schedules
      now; patients will see you once you are approved.
    </Alert>
  );
}

/** The navigation, minus the parts the hospital's plan does not include, plus the plan notice. */
function Frame({ children }: { children: React.ReactNode }) {
  const sub = useApi<SubscriptionView>("/hospital/subscription");
  const plan = sub.data?.plan;
  const nav = NAV.filter(
    (item) =>
      !(item.href === "/hospital/analytics" && plan && !plan.analytics) &&
      !(item.href === "/hospital/slips" && plan && !plan.slipPrinting),
  );
  return (
    <DashboardShell nav={nav}>
      <PendingBanner />
      <SubscriptionBanner view={sub.data} />
      {children}
    </DashboardShell>
  );
}

/** Every /hospital page except /hospital/login: hospital admins only. */
export default function HospitalPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["HOSPITAL_ADMIN"]} loginPath="/hospital/login">
      <Frame>{children}</Frame>
    </RequireRole>
  );
}
