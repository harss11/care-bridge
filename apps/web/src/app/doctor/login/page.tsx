import type { Metadata } from "next";
import { StaffLoginForm } from "@/components/staff-login-form";

export const metadata: Metadata = { title: "Doctor login" };

export default function DoctorLoginPage() {
  return <StaffLoginForm title="Doctor login" subtitle="See today's queue and your patients." />;
}
