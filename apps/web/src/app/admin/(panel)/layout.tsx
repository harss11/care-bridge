"use client";

import { RequireRole } from "@/components/auth-guards";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/hospitals", label: "Hospitals" },
  { href: "/admin/blood-banks", label: "Blood banks" },
  { href: "/admin/blood-requests", label: "Blood requests" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
];

/** Every /admin page except /admin/login: admin-only, with the admin navigation. */
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["ADMIN"]} loginPath="/admin/login">
      <DashboardShell nav={NAV}>{children}</DashboardShell>
    </RequireRole>
  );
}
