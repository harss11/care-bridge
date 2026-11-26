import type { Metadata } from "next";
import { StaffLoginForm } from "@/components/staff-login-form";

export const metadata: Metadata = { title: "Reception login" };

export default function ReceptionLoginPage() {
  return (
    <StaffLoginForm
      title="Reception desk"
      subtitle="Use the login your hospital administrator created for you."
    />
  );
}
