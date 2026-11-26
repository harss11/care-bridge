import { z } from "zod";

const emailSchema = z.email();

/** Trims and lower-cases an email address. Returns null when it is not a valid address. */
export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (value.length > 254) return null;
  return emailSchema.safeParse(value).success ? value : null;
}

/** "rahul.sharma@gmail.com" -> "ra*********@gmail.com" for logs and UI hints. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "*".repeat(address.length);
  const local = address.slice(0, at);
  const keep = local.length <= 2 ? 1 : 2;
  return local.slice(0, keep) + "*".repeat(Math.max(local.length - keep, 1)) + address.slice(at);
}
