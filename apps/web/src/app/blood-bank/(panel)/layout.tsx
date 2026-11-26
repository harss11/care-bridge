"use client";

import { RequireRole } from "@/components/auth-guards";
import { BankStatusBanner } from "@/components/blood/bank-status-banner";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV = [
  { href: "/blood-bank", label: "Overview" },
  { href: "/blood-bank/donations", label: "Donations" },
  { href: "/blood-bank/stock", label: "Stock" },
  { href: "/blood-bank/staff", label: "Staff" },
  { href: "/blood-bank/profile", label: "Profile" },
];

/** Everything under /blood-bank except the login page: blood bank staff only. */
export default function BloodBankPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["BLOOD_BANK_STAFF"]} loginPath="/blood-bank/login">
      <DashboardShell nav={NAV}>
        <BankStatusBanner />
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
