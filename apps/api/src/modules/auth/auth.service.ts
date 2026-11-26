import { env, phoneLoginEnabled } from "../../config/env.js";
import { toLanguage, type Language } from "../../utils/language.js";
import {
  Prisma,
  type BloodBankStatus,
  type HospitalStatus,
  type Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthContext } from "../../middleware/authenticate.js";
import { audit, auditSafe } from "../../utils/audit.js";
import { AppError } from "../../utils/http.js";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../../utils/password.js";
import { normalizeEmail } from "../../utils/email.js";
import { normalizeMobile } from "../../utils/phone.js";
import type { RequestMeta } from "../../utils/request.js";
import type {
  ChangePasswordInput,
  EmailOtpVerifyInput,
  OtpVerifyInput,
  PatientSignupInput,
  StaffLoginInput,
} from "./auth.schemas.js";
import { consumeLoginOtp, sendEmailLoginOtp, sendLoginOtp } from "./otp.service.js";
import {
  issueRefreshToken,
  revokeAllForUser,
  revokeFamily,
  rotateRefreshToken,
  signAccessToken,
  signSignupToken,
  verifySignupToken,
  type IssuedRefreshToken,
} from "./tokens.js";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

// ---------------------------------------------------------------------------
// Public user shape: the only user representation that leaves the API
// ---------------------------------------------------------------------------

const publicUserSelect = {
  id: true,
  role: true,
  status: true,
  name: true,
  loginId: true,
  phone: true,
  email: true,
  hospitalId: true,
  tokenVersion: true,
  mustChangePassword: true,
  language: true,
  hospital: { select: { id: true, name: true, slug: true, status: true } },
  bloodBankId: true,
  bloodBank: { select: { id: true, name: true, status: true } },
} satisfies Prisma.UserSelect;

type UserForSession = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export interface PublicUser {
  id: string;
  role: Role;
  name: string;
  loginId: string | null;
  phone: string | null;
  email: string | null;
  hospitalId: string | null;
  hospital: { id: string; name: string; slug: string; status: HospitalStatus } | null;
  bloodBankId: string | null;
  bloodBank: { id: string; name: string; status: BloodBankStatus } | null;
  mustChangePassword: boolean;
  /** The language the person chose for MediQ and its messages ("en" or "hi"). */
  language: Language;
}

export function toPublicUser(u: UserForSession): PublicUser {
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    loginId: u.loginId,
    phone: u.phone,
    email: u.email,
    hospitalId: u.hospitalId,
    hospital: u.hospital
      ? {
          id: u.hospital.id,
          name: u.hospital.name,
          slug: u.hospital.slug,
          status: u.hospital.status,
        }
      : null,
    bloodBankId: u.bloodBankId,
    bloodBank: u.bloodBank,
    mustChangePassword: u.mustChangePassword,
    language: toLanguage(u.language),
  };
}

export interface Session {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PublicUser;
}

function buildSession(user: UserForSession, refresh: IssuedRefreshToken): Session {
  const access = signAccessToken(user);
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
    user: toPublicUser(user),
  };
}

async function startSession(user: UserForSession, meta: RequestMeta): Promise<Session> {
  const refresh = await issueRefreshToken(prisma, user.id, meta);
  return buildSession(user, refresh);
}

function assertCanSignIn(user: UserForSession): void {
  if (user.status === "BLOCKED") {
    throw AppError.forbidden("This account has been blocked. Contact support.", "ACCOUNT_BLOCKED");
  }
  if (user.hospital?.status === "BLOCKED") {
    throw AppError.forbidden(
      "This hospital has been blocked. Contact support.",
      "HOSPITAL_BLOCKED",
    );
  }
  if (user.bloodBank?.status === "BLOCKED") {
    throw AppError.forbidden(
      "This blood bank has been blocked. Contact support.",
      "BLOOD_BANK_BLOCKED",
    );
  }
}

// ---------------------------------------------------------------------------
// Staff: login ID + password (admin, hospital admin, receptionist, doctor)
// ---------------------------------------------------------------------------

export async function staffLogin(input: StaffLoginInput, meta: RequestMeta): Promise<Session> {
  const invalid = AppError.unauthorized("Invalid login ID or password", "INVALID_CREDENTIALS");

  const user = await prisma.user.findUnique({
    where: { loginId: input.loginId },
    select: { ...publicUserSelect, passwordHash: true, failedLoginCount: true, lockedUntil: true },
  });

  if (!user || !user.passwordHash || user.role === "PATIENT") {
    await burnPasswordCheck(input.password);
    throw invalid;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    throw AppError.tooMany(
      `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      "ACCOUNT_LOCKED",
      { retryAfterSeconds },
    );
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    const { failedLoginCount } = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (failedLoginCount >= MAX_FAILED_LOGINS) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
        },
      });
      await auditSafe(prisma, {
        action: "auth.account_locked",
        entityType: "User",
        entityId: user.id,
        hospitalId: user.hospitalId,
        metadata: { failedAttempts: failedLoginCount, lockMinutes: LOCKOUT_MINUTES },
        meta,
      });
    }
    throw invalid;
  }

  // Only reveal blocked status to someone who knows the password.
  assertCanSignIn(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await auditSafe(prisma, {
    actor: { userId: user.id, role: user.role },
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    hospitalId: user.hospitalId,
    metadata: { method: "password" },
    meta,
  });

  return startSession(user, meta);
}

// ---------------------------------------------------------------------------
// Patients: email OTP (the default) or phone OTP. Sign up and log in are the same flow.
// ---------------------------------------------------------------------------

/** Which ways a patient can log in right now (the login page shows only these). */
export function patientLoginMethods() {
  return { email: true, phone: phoneLoginEnabled };
}

function requirePhone(input: string): string {
  const phone = normalizeMobile(input);
  if (!phone) throw AppError.badRequest("Enter a valid mobile number", "INVALID_PHONE");
  return phone;
}

function requireEmail(input: string): string {
  const address = normalizeEmail(input);
  if (!address) throw AppError.badRequest("Enter a valid email address", "INVALID_EMAIL");
  return address;
}

function assertPhoneLoginEnabled(): void {
  if (!phoneLoginEnabled) {
    throw AppError.badRequest(
      "Login with a mobile number is not available yet. Please use your email address.",
      "PHONE_LOGIN_DISABLED",
    );
  }
}

/** Email is not unique on users (staff may share one), so a patient is found by email and role. */
function findPatientByEmail(db: Pick<typeof prisma, "user">, address: string) {
  return db.user.findFirst({
    where: { role: "PATIENT", email: { equals: address, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: publicUserSelect,
  });
}

export async function requestPatientOtp(phoneInput: string, meta: RequestMeta) {
  assertPhoneLoginEnabled();
  return sendLoginOtp(requirePhone(phoneInput), meta);
}

export async function requestPatientEmailOtp(emailInput: string, meta: RequestMeta) {
  return sendEmailLoginOtp(requireEmail(emailInput), meta);
}

export type OtpVerifyResult =
  | { status: "AUTHENTICATED"; session: Session }
  | { status: "SIGNUP_REQUIRED"; signupToken: string };

async function signInPatient(user: UserForSession, meta: RequestMeta): Promise<OtpVerifyResult> {
  if (user.role !== "PATIENT") throw AppError.forbidden();
  assertCanSignIn(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { status: "AUTHENTICATED", session: await startSession(user, meta) };
}

/**
 * Verifies the OTP. Existing patients get a session. New numbers get a
 * short-lived sign-up token instead: they must give their name and accept the
 * privacy policy and terms (DPDP consent) before an account is created.
 */
export async function verifyPatientOtp(
  input: OtpVerifyInput,
  meta: RequestMeta,
): Promise<OtpVerifyResult> {
  assertPhoneLoginEnabled();
  const phone = requirePhone(input.phone);
  await consumeLoginOtp(phone, input.code);

  const user = await prisma.user.findUnique({ where: { phone }, select: publicUserSelect });
  if (!user) return { status: "SIGNUP_REQUIRED", signupToken: signSignupToken({ phone }) };
  return signInPatient(user, meta);
}

/** Same as verifyPatientOtp, for a code sent by email. */
export async function verifyPatientEmailOtp(
  input: EmailOtpVerifyInput,
  meta: RequestMeta,
): Promise<OtpVerifyResult> {
  const address = requireEmail(input.email);
  await consumeLoginOtp(address, input.code);

  const user = await findPatientByEmail(prisma, address);
  if (!user) return { status: "SIGNUP_REQUIRED", signupToken: signSignupToken({ email: address }) };
  return signInPatient(user, meta);
}

export async function completePatientSignup(
  input: PatientSignupInput,
  meta: RequestMeta,
): Promise<Session> {
  const identity = verifySignupToken(input.signupToken);
  const phone = identity.phone ?? null;
  const address = identity.email ?? null;

  const findExisting = (db: Pick<typeof prisma, "user">) =>
    phone
      ? db.user.findUnique({ where: { phone }, select: publicUserSelect })
      : findPatientByEmail(db, address!);

  // Idempotent: a double-submitted form just logs the user in.
  const existing = await findExisting(prisma);
  if (existing) {
    assertCanSignIn(existing);
    return startSession(existing, meta);
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      // Email has no unique index, so two sign-ups for one address are serialised here instead.
      if (address) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signup:${address}`}))`;
        const raced = await findExisting(tx);
        if (raced) return raced;
      }
      const created = await tx.user.create({
        data: {
          role: "PATIENT",
          name: input.name,
          phone,
          email: address,
          lastLoginAt: new Date(),
          patientProfiles: { create: { relation: "SELF", fullName: input.name, phone } },
          consents: {
            create: [
              {
                type: "PRIVACY_POLICY",
                version: env.PRIVACY_POLICY_VERSION,
                ip: meta.ip,
                userAgent: meta.userAgent,
              },
              {
                type: "TERMS_OF_SERVICE",
                version: env.TERMS_VERSION,
                ip: meta.ip,
                userAgent: meta.userAgent,
              },
            ],
          },
        },
        select: publicUserSelect,
      });
      await audit(tx, {
        actor: { userId: created.id, role: "PATIENT" },
        action: "patient.signed_up",
        entityType: "User",
        entityId: created.id,
        metadata: {
          method: address ? "email" : "phone",
          privacyPolicyVersion: env.PRIVACY_POLICY_VERSION,
          termsVersion: env.TERMS_VERSION,
        },
        meta,
      });
      return created;
    });
    assertCanSignIn(user);
    return startSession(user, meta);
  } catch (err) {
    // Two sign-ups for the same phone raced; the other one won, so log in.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && phone) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { phone },
        select: publicUserSelect,
      });
      return startSession(user, meta);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export async function refreshSession(rawToken: string, meta: RequestMeta): Promise<Session> {
  const { userId, next } = await rotateRefreshToken(rawToken, meta);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw AppError.unauthorized("Please log in again", "INVALID_REFRESH_TOKEN");
  try {
    assertCanSignIn(user);
  } catch (err) {
    await revokeFamily(next.familyId);
    throw err;
  }
  return buildSession(user, next);
}

export async function getCurrentUser(auth: AuthContext): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: publicUserSelect,
  });
  if (!user) throw AppError.unauthorized();
  return toPublicUser(user);
}

/**
 * Changes a staff password (also used for the forced first-login reset).
 * Signs out every other device: all refresh tokens are revoked and tokenVersion
 * is bumped so existing access tokens stop working immediately.
 */
export async function changePassword(
  auth: AuthContext,
  input: ChangePasswordInput,
  meta: RequestMeta,
): Promise<Session> {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      role: true,
      loginId: true,
      hospitalId: true,
      mustChangePassword: true,
      passwordHash: true,
    },
  });
  if (!user?.passwordHash) {
    throw AppError.badRequest("This account does not use a password", "NO_PASSWORD");
  }

  // 400, not 401: a wrong current password must not look like an expired session to the client.
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw AppError.badRequest("Current password is incorrect", "INVALID_CURRENT_PASSWORD");
  }
  if (input.newPassword === input.currentPassword) {
    throw AppError.badRequest(
      "New password must be different from the current one",
      "PASSWORD_REUSED",
    );
  }
  if (user.loginId && input.newPassword.toLowerCase().includes(user.loginId)) {
    throw AppError.badRequest("Password must not contain your login ID", "WEAK_PASSWORD");
  }

  const passwordHash = await hashPassword(input.newPassword);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
      select: publicUserSelect,
    });
    await revokeAllForUser(tx, user.id);
    await audit(tx, {
      actor: { userId: user.id, role: user.role },
      action: "auth.password_changed",
      entityType: "User",
      entityId: user.id,
      hospitalId: user.hospitalId,
      metadata: { forcedReset: user.mustChangePassword },
      meta,
    });
    return u;
  });

  return startSession(updated, meta);
}
