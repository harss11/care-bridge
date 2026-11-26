import type { Metadata } from "next";
import Link from "next/link";
import { StaffLoginForm } from "@/components/staff-login-form";

export const metadata: Metadata = { title: "Blood bank login" };

export default function BloodBankLoginPage() {
  return (
    <>
      <StaffLoginForm
        title="Blood bank"
        subtitle="Use the login you chose when you registered, or the one a colleague created for you."
      />
      <p className="pb-10 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/blood/register-bank" className="font-semibold text-brand-800 hover:underline">
          Register your blood bank
        </Link>
      </p>
    </>
  );
}
