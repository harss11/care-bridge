import { env } from "../../config/env.js";
import type { OtpPurpose } from "../../generated/prisma/client.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { email } from "../../services/email/index.js";
import { sms } from "../../services/sms/index.js";
import { hmacSha256, randomNumericCode, safeEqualHex } from "../../utils/crypto.js";
import { AppError } from "../../utils/http.js";
import { maskEmail } from "../../utils/email.js";
import { maskPhone } from "../../utils/phone.js";
import type { RequestMeta } from "../../utils/request.js";

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

/** The code is bound to its destination (phone or email) and hashed with a server secret. */
function hashCode(destination: string, code: string): string {
  return hmacSha256(env.OTP_HMAC_SECRET, `${destination}:${code}`);
}

/**
 * Creates and sends a login OTP. Per-phone limits are enforced in the database
 * (so they hold across API instances): one OTP per 60 s and 5 per hour.
 */
export async function sendLoginOtp(phone: string, meta: RequestMeta) {
  return sendOtp(phone, "LOGIN", meta);
}

/** The text of a code message. Login keeps its original wording (already registered with the SMS regulator). */
function otpText(purpose: OtpPurpose, code: string): { template: string; body: string } {
  const minutes = OTP_TTL_SECONDS / 60;
  return purpose === "LOGIN"
    ? {
        template: "otp_login",
        body: `${code} is your MediQ login code. It expires in ${minutes} minutes. Do not share it with anyone.`,
      }
    : {
        template: "otp_verify",
        body: `${code} is your MediQ verification code. It expires in ${minutes} minutes. Do not share it with anyone.`,
      };
}

/**
 * Creates a new code for a destination (an E.164 phone number, or a lower-case email address for
 * email login) and enforces the limits: one code per 60 s and 5 per hour, per destination. The
 * limits live in the database so they hold across API instances.
 */
async function createOtpCode(destination: string, purpose: OtpPurpose, meta: RequestMeta) {
  const code = randomNumericCode(OTP_LENGTH);
  const now = Date.now();

  const otp = await prisma.$transaction(async (tx) => {
    // Serialise concurrent requests for the same destination so the limits can't be raced.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${destination}))`;

    const recent = await tx.otpCode.findMany({
      where: { phone: destination, purpose, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const last = recent[0];
    if (last) {
      const elapsed = Math.floor((now - last.createdAt.getTime()) / 1000);
      if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfterSeconds = OTP_RESEND_COOLDOWN_SECONDS - elapsed;
        throw AppError.tooMany(
          `Please wait ${retryAfterSeconds} seconds before requesting another code`,
          "OTP_COOLDOWN",
          { retryAfterSeconds },
        );
      }
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
      throw AppError.tooMany("Too many codes requested. Try again in an hour.", "OTP_LIMIT", {
        retryAfterSeconds: 3600,
      });
    }

    // Only the newest code is valid.
    await tx.otpCode.updateMany({
      where: { phone: destination, purpose, consumedAt: null },
      data: { consumedAt: new Date(now) },
    });

    return tx.otpCode.create({
      data: {
        // The column is named phone; for email login it holds the email address.
        phone: destination,
        purpose,
        codeHash: hashCode(destination, code),
        expiresAt: new Date(now + OTP_TTL_SECONDS * 1000),
        ip: meta.ip ?? null,
      },
      select: { id: true },
    });
  });

  return { id: otp.id, code };
}

/** Sends a one-time code by SMS for any purpose (login, a blood request, registering a blood bank). */
export async function sendOtp(phone: string, purpose: OtpPurpose, meta: RequestMeta) {
  const otp = await createOtpCode(phone, purpose, meta);
  const code = otp.code;

  // Send outside the transaction so a slow provider doesn't hold a DB connection.
  try {
    const text = otpText(purpose, code);
    const result = await sms.send({
      to: phone,
      template: text.template,
      variables: { otp: code, minutes: String(OTP_TTL_SECONDS / 60) },
      body: text.body,
    });
    await prisma.notificationLog.create({
      data: {
        channel: "SMS",
        provider: sms.name,
        to: phone,
        template: otpText(purpose, "").template,
        status: "SENT",
        providerMessageId: result.providerMessageId ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, phone: maskPhone(phone) }, "failed to send OTP");
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    await prisma.notificationLog.create({
      data: {
        channel: "SMS",
        provider: sms.name,
        to: phone,
        template: otpText(purpose, "").template,
        status: "FAILED",
        error: err instanceof Error ? err.message.slice(0, 500) : "unknown",
      },
    });
    throw new AppError(502, "SMS_FAILED", "We couldn't send the code. Please try again.");
  }

  return {
    phone: maskPhone(phone),
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

/** The login code email. Plain and short so it is not mistaken for marketing. */
export function loginEmail(code: string) {
  const minutes = OTP_TTL_SECONDS / 60;
  const text = `${code} is your MediQ login code. It expires in ${minutes} minutes. Do not share it with anyone.

If you did not try to log in to MediQ, you can ignore this email.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;line-height:1.5">
<p>Your MediQ login code is:</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
<p>It expires in ${minutes} minutes. Do not share it with anyone, including MediQ staff.</p>
<p style="color:#64748b;font-size:13px">If you did not try to log in to MediQ, you can ignore this email.</p>
</div>`;
  return { subject: `${code} is your MediQ login code`, text, html };
}

/** Sends a login code to a patient's email address (already normalised to lower case). */
export async function sendEmailLoginOtp(address: string, meta: RequestMeta) {
  const otp = await createOtpCode(address, "LOGIN", meta);
  try {
    await email.send({ to: address, ...loginEmail(otp.code) });
  } catch (err) {
    logger.error(
      { err, email: maskEmail(address), provider: email.name },
      "failed to send email OTP",
    );
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    throw new AppError(502, "EMAIL_FAILED", "We couldn't send the code. Please try again.");
  }
  return {
    email: maskEmail(address),
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

/** Checks a code. Each OTP allows 5 attempts and can be used once. */
export async function consumeLoginOtp(phone: string, code: string): Promise<void> {
  return consumeOtp(phone, code, "LOGIN");
}

/** Checks a code for any purpose. A code made for one purpose is useless for another. */
export async function consumeOtp(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.expiresAt <= new Date()) {
    throw AppError.badRequest("This code has expired. Please request a new one.", "OTP_EXPIRED");
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    throw AppError.badRequest(
      "Too many wrong attempts. Please request a new code.",
      "OTP_TOO_MANY_ATTEMPTS",
    );
  }

  if (!safeEqualHex(hashCode(phone, code), otp.codeHash)) {
    const bumped = await prisma.otpCode.updateMany({
      where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    const attemptsLeft = bumped.count ? Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts - 1) : 0;
    throw AppError.badRequest("Incorrect code", "OTP_INVALID", { attemptsLeft });
  }

  // Conditional update: if two requests race with the right code, only one wins.
  const consumed = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) {
    throw AppError.badRequest("This code has already been used", "OTP_EXPIRED");
  }
}
