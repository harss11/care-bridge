import type { Metadata } from "next";
import { StaffLoginForm } from "@/components/staff-login-form";

export const metadata: Metadata = { title: "Hospital login" };

export default function HospitalLoginPage() {
  return (
    <StaffLoginForm
      title="Hospital login"
      subtitle="Use the login ID and password provided by MediQ."
    />
  );
}
