import type { Metadata } from "next";
import { StaffLoginForm } from "@/components/staff-login-form";

export const metadata: Metadata = { title: "Admin login" };

export default function AdminLoginPage() {
  return <StaffLoginForm title="Admin console" subtitle="Platform administrators only." />;
}
