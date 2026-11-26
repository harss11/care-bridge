import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

/**
 * Email providers sit behind this interface (like SMS) so they can be swapped without
 * touching business code. Used for patients' login codes.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailResult {
  providerMessageId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

/** A provider call failed. */
export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

const TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Mock: prints to the API console in development, records in memory for tests
// ---------------------------------------------------------------------------

export const mockEmailOutbox: EmailMessage[] = [];

class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  async send(message: EmailMessage): Promise<EmailResult> {
    mockEmailOutbox.push(message);
    if (mockEmailOutbox.length > 500) mockEmailOutbox.shift();
    if (env.NODE_ENV !== "test") {
      // Intentionally console, not the logger: the logger redacts codes.
      console.warn(
        `\n┌─ MOCK EMAIL ─────────────────────────────\n│ to:      ${message.to}\n│ subject: ${message.subject}\n│ text:    ${message.text}\n└──────────────────────────────────────────\n`,
      );
    }
    return { providerMessageId: `mock-${Date.now()}` };
  }
}

// ---------------------------------------------------------------------------
// SMTP (e.g. Gmail with an app password)
// ---------------------------------------------------------------------------

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private readonly transport: nodemailer.Transporter;

  constructor(
    private readonly from: string,
    options: { host: string; port: number; secure: boolean; user: string; pass: string },
  ) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: { user: options.user, pass: options.pass },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const info = (await this.transport.sendMail({ from: this.from, ...message })) as {
        messageId?: string;
      };
      return { providerMessageId: info.messageId };
    } catch (err) {
      throw new EmailError(`SMTP: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Brevo (formerly Sendinblue): https://developers.brevo.com/reference/sendtransacemail
// ---------------------------------------------------------------------------

/** "Care Bridge <a@b.com>" -> { name: "Care Bridge", email: "a@b.com" } */
export function parseAddress(from: string): { name?: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!m) return { email: from.trim() };
  const name = m[1]!.replace(/^"|"$/g, "").trim();
  return name ? { name, email: m[2]!.trim() } : { email: m[2]!.trim() };
}

export class BrevoEmailProvider implements EmailProvider {
  readonly name = "brevo";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await this.fetchImpl("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: parseAddress(this.from),
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          ...(message.html ? { htmlContent: message.html } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new EmailError(`Brevo unreachable: ${(err as Error).message}`);
    }
    const json = (await res.json().catch(() => null)) as {
      messageId?: string;
      message?: string;
    } | null;
    if (!res.ok) throw new EmailError(`Brevo: ${json?.message ?? `HTTP ${res.status}`}`);
    return { providerMessageId: json?.messageId };
  }
}

// ---------------------------------------------------------------------------
// Resend: https://resend.com/docs/api-reference/emails/send-email
// ---------------------------------------------------------------------------

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new EmailError(`Resend unreachable: ${(err as Error).message}`);
    }
    const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok || !json?.id) {
      throw new EmailError(`Resend: ${json?.message ?? `HTTP ${res.status}`}`);
    }
    return { providerMessageId: json.id };
  }
}

// ---------------------------------------------------------------------------

function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "mock":
      return new MockEmailProvider();
    case "smtp":
      return new SmtpEmailProvider(env.EMAIL_FROM!, {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
        user: env.SMTP_USER!,
        pass: env.SMTP_PASS!,
      });
    case "brevo":
      return new BrevoEmailProvider(env.BREVO_API_KEY!, env.EMAIL_FROM!);
    case "resend":
      return new ResendEmailProvider(env.RESEND_API_KEY!, env.EMAIL_FROM!);
  }
}

const baseProvider = createEmailProvider();
let override: EmailProvider | null = null;

/** The provider the app sends through. Delegates, so tests can swap the real one for a fake. */
export const email: EmailProvider = {
  get name() {
    return (override ?? baseProvider).name;
  },
  send: (message) => (override ?? baseProvider).send(message),
};

/** Tests only: replace the provider (null restores the configured one). */
export function setEmailProviderOverride(provider: EmailProvider | null): void {
  override = provider;
}

logger.debug({ provider: baseProvider.name }, "email provider ready");
if (baseProvider.name === "mock" && env.NODE_ENV !== "test" && process.env.VERCEL) {
  // Deployed with the mock: patients' login codes only reach this log. Set EMAIL_PROVIDER.
  logger.warn("EMAIL_PROVIDER is mock: login codes are printed to the log, not emailed");
}
