import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { mockEmailOutbox } from "../../services/email/index.js";
import { randomToken } from "../../utils/crypto.js";
import {
  completePatientSignup,
  patientLoginMethods,
  requestPatientEmailOtp,
  verifyPatientEmailOtp,
} from "./auth.service.js";

const meta = { ip: "127.0.0.1", userAgent: "vitest" };
const created: string[] = [];

function lastCodeFor(address: string): string {
  const message = [...mockEmailOutbox].reverse().find((m) => m.to === address);
  const code = /\b(\d{6})\b/.exec(message?.subject ?? "")?.[1];
  if (!code) throw new Error(`no code emailed to ${address}`);
  return code;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created } } });
});

describe("patient email login", () => {
  it("offers email login always", () => {
    expect(patientLoginMethods().email).toBe(true);
  });

  it("signs up a new address, then logs the same person in again", async () => {
    const address = `pat-${randomToken(4)
      .replace(/[^a-z0-9]/gi, "x")
      .toLowerCase()}@example.com`;

    const sent = await requestPatientEmailOtp(`  ${address.toUpperCase()} `, meta);
    expect(sent.email).toMatch(/\*+@example\.com$/);

    const first = await verifyPatientEmailOtp({ email: address, code: lastCodeFor(address) }, meta);
    expect(first.status).toBe("SIGNUP_REQUIRED");
    if (first.status !== "SIGNUP_REQUIRED") return;

    const session = await completePatientSignup(
      {
        signupToken: first.signupToken,
        name: "Email Patient",
        acceptPrivacyPolicy: true,
        acceptTerms: true,
      },
      meta,
    );
    created.push(session.user.id);
    expect(session.user).toMatchObject({ role: "PATIENT", email: address, phone: null });
    const profiles = await prisma.patientProfile.findMany({ where: { userId: session.user.id } });
    expect(profiles).toHaveLength(1);

    // A second sign-up with the same token is idempotent.
    const again = await completePatientSignup(
      {
        signupToken: first.signupToken,
        name: "Email Patient",
        acceptPrivacyPolicy: true,
        acceptTerms: true,
      },
      meta,
    );
    expect(again.user.id).toBe(session.user.id);

    // Next login: the cooldown is per address, so move the last code back in time.
    await prisma.otpCode.updateMany({
      where: { phone: address },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) },
    });
    await requestPatientEmailOtp(address, meta);
    const second = await verifyPatientEmailOtp(
      { email: address, code: lastCodeFor(address) },
      meta,
    );
    expect(second.status).toBe("AUTHENTICATED");
    if (second.status === "AUTHENTICATED") expect(second.session.user.id).toBe(session.user.id);
  });

  it("rejects a wrong code and a resend inside the cooldown", async () => {
    const address = `pat-${randomToken(4)
      .replace(/[^a-z0-9]/gi, "x")
      .toLowerCase()}@example.com`;
    await requestPatientEmailOtp(address, meta);
    const right = lastCodeFor(address);
    const wrong = right === "000000" ? "111111" : "000000";
    await expect(
      verifyPatientEmailOtp({ email: address, code: wrong }, meta),
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
    await expect(requestPatientEmailOtp(address, meta)).rejects.toMatchObject({
      code: "OTP_COOLDOWN",
    });
  });

  it("rejects an invalid address", async () => {
    await expect(requestPatientEmailOtp("not-an-email", meta)).rejects.toMatchObject({
      code: "INVALID_EMAIL",
    });
  });
});
