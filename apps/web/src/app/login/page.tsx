"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRedirectIfAuthenticated } from "@/components/auth-guards";
import { Alert, Button, Card, Field, FullPageSpinner, Logo } from "@/components/ui";
import { ApiError, api, applySession } from "@/lib/api";
import { safeNext } from "@/lib/next-path";
import { homeFor } from "@/lib/roles";
import type { Session } from "@/lib/types";

type Step = "identify" | "otp" | "signup";
type Method = "email" | "phone";

interface OtpRequestResponse {
  /** Masked destination: phone for SMS codes, email for email codes. */
  phone?: string;
  email?: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

interface LoginMethods {
  email: boolean;
  phone: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type OtpVerifyResponse = Session | { status: "SIGNUP_REQUIRED"; signupToken: string };

/**
 * Patient login and sign-up: email (or mobile, when SMS is set up) -> OTP -> (new users only)
 * name + consent.
 */
export default function PatientLoginPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <PatientLogin />
    </Suspense>
  );
}

function PatientLogin() {
  const router = useRouter();
  // After login, return to where the visitor came from (e.g. the slot they picked).
  const next = safeNext(useSearchParams().get("next"));
  const status = useRedirectIfAuthenticated(next);

  const [step, setStep] = useState<Step>("identify");
  const [method, setMethod] = useState<Method>("email");
  const [methods, setMethods] = useState<LoginMethods>({ email: true, phone: false });
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [name, setName] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Phone login is offered only when the server can actually send SMS.
  useEffect(() => {
    let cancelled = false;
    api
      .get<LoginMethods>("/auth/methods", { auth: false })
      .then((m) => {
        if (!cancelled) setMethods(m);
      })
      .catch(() => {
        // Older API or offline: email only.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      if (err instanceof ApiError && err.code === "SIGNUP_TOKEN_INVALID") {
        setStep("identify");
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  }

  function finish(session: Session) {
    applySession(session);
    router.replace(next ?? homeFor(session.user));
  }

  const requestOtp = () =>
    run(async () => {
      const res =
        method === "email"
          ? await api.post<OtpRequestResponse>(
              "/auth/email-otp/request",
              { email },
              { auth: false },
            )
          : await api.post<OtpRequestResponse>("/auth/otp/request", { phone }, { auth: false });
      setMaskedDestination(res.email ?? res.phone ?? "");
      setResendIn(res.resendAfterSeconds);
      setCode("");
      setStep("otp");
    });

  const onIdentifySubmit = (e: FormEvent) => {
    e.preventDefault();
    void requestOtp();
  };

  const onOtpSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res =
        method === "email"
          ? await api.post<OtpVerifyResponse>(
              "/auth/email-otp/verify",
              { email, code },
              { auth: false },
            )
          : await api.post<OtpVerifyResponse>("/auth/otp/verify", { phone, code }, { auth: false });
      if ("signupToken" in res) {
        setSignupToken(res.signupToken);
        setStep("signup");
      } else {
        finish(res);
      }
    });
  };

  const onSignupSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const session = await api.post<Session>(
        "/auth/patient/signup",
        { signupToken, name, acceptPrivacyPolicy: acceptPrivacy, acceptTerms },
        { auth: false },
      );
      finish(session);
    });
  };

  if (status !== "anonymous") return <FullPageSpinner />;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Logo />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            {step === "signup" ? "Create your account" : "Log in or sign up"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {step === "identify" &&
              (method === "email"
                ? "We'll email you a one-time code."
                : "We'll send a one-time code to your mobile number.")}
            {step === "otp" &&
              `Enter the 6-digit code sent to ${maskedDestination}.` +
                (method === "email" ? " Check your spam folder if you don't see it." : "")}
            {step === "signup" && "Just one more step to book your first appointment."}
          </p>
        </div>

        <Card>
          {error && (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          )}

          {step === "identify" && (
            <form onSubmit={onIdentifySubmit} className="space-y-4" noValidate>
              {method === "email" ? (
                <Field
                  key="email"
                  label="Email address"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              ) : (
                <Field
                  key="phone"
                  label="Mobile number"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  prefix="+91"
                  placeholder="98765 43210"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              )}
              <Button
                type="submit"
                className="w-full"
                loading={busy}
                disabled={
                  method === "email"
                    ? !EMAIL_RE.test(email.trim())
                    : phone.replace(/\D/g, "").length < 10
                }
              >
                Send code
              </Button>
              {methods.phone && (
                <button
                  type="button"
                  className="w-full text-center text-sm font-medium text-brand-700 hover:underline"
                  onClick={() => {
                    setMethod(method === "email" ? "phone" : "email");
                    setError(null);
                  }}
                >
                  {method === "email" ? "Use mobile number instead" : "Use email instead"}
                </button>
              )}
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={onOtpSubmit} className="space-y-4" noValidate>
              <Field
                label="One-time code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="••••••"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.5em]"
              />
              <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>
                Verify
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="font-medium text-slate-600 hover:text-slate-900"
                  onClick={() => {
                    setStep("identify");
                    setError(null);
                  }}
                >
                  {method === "email" ? "Change email" : "Change number"}
                </button>
                <button
                  type="button"
                  className="font-medium text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline"
                  disabled={resendIn > 0 || busy}
                  onClick={() => void requestOtp()}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {step === "signup" && (
            <form onSubmit={onSignupSubmit} className="space-y-4" noValidate>
              <Field
                label="Full name"
                name="name"
                autoComplete="name"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                hint="As it should appear on your appointment slip."
              />
              <fieldset className="space-y-3 text-sm text-slate-700">
                <legend className="sr-only">Consent</legend>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-brand-700"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                  />
                  <span>
                    I consent to MediQ processing my personal and health data to book and manage
                    appointments, as described in the{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="font-medium text-brand-700 underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-brand-700"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="font-medium text-brand-700 underline"
                    >
                      Terms of Service
                    </Link>
                    .
                  </span>
                </label>
              </fieldset>
              <Button
                type="submit"
                className="w-full"
                loading={busy}
                disabled={name.trim().length < 2 || !acceptPrivacy || !acceptTerms}
              >
                Create account
              </Button>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-slate-500">
          Hospital staff?{" "}
          <Link href="/reception/login" className="font-medium text-brand-700 hover:underline">
            Staff login
          </Link>
        </p>
      </div>
    </main>
  );
}
