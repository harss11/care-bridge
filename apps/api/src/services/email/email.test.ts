import { describe, expect, it } from "vitest";
import { loginEmail } from "../../modules/auth/otp.service.js";
import { maskEmail, normalizeEmail } from "../../utils/email.js";
import {
  BrevoEmailProvider,
  EmailError,
  ResendEmailProvider,
  email,
  mockEmailOutbox,
  parseAddress,
} from "./index.js";

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("email utils", () => {
  it("normalises and validates addresses", () => {
    expect(normalizeEmail("  Rahul.Sharma@Gmail.COM ")).toBe("rahul.sharma@gmail.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
  });

  it("masks addresses for logs and hints", () => {
    expect(maskEmail("rahul@gmail.com")).toBe("ra***@gmail.com");
    expect(maskEmail("a@x.in")).toBe("a*@x.in");
  });

  it("parses a sender with or without a name", () => {
    expect(parseAddress("Care Bridge <hi@mediq.in>")).toEqual({
      name: "Care Bridge",
      email: "hi@mediq.in",
    });
    expect(parseAddress('"Care Bridge" <hi@mediq.in>')).toEqual({
      name: "Care Bridge",
      email: "hi@mediq.in",
    });
    expect(parseAddress("hi@mediq.in")).toEqual({ email: "hi@mediq.in" });
  });
});

describe("login email", () => {
  it("carries the code in the subject and both bodies", () => {
    const m = loginEmail("123456");
    expect(m.subject).toContain("123456");
    expect(m.text).toContain("123456");
    expect(m.html).toContain("123456");
  });
});

describe("email providers", () => {
  it("the mock records messages", async () => {
    await email.send({ to: "x@y.com", subject: "s", text: "t" });
    expect(mockEmailOutbox.at(-1)).toMatchObject({ to: "x@y.com", subject: "s" });
  });

  it("Brevo sends the sender, recipient and content", async () => {
    const { impl, calls } = fakeFetch(201, { messageId: "<m1>" });
    const p = new BrevoEmailProvider("key", "Care Bridge <hi@mediq.in>", impl);
    await expect(p.send({ to: "a@b.com", subject: "S", text: "T" })).resolves.toEqual({
      providerMessageId: "<m1>",
    });
    expect(calls[0]!.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((calls[0]!.init.headers as Record<string, string>)["api-key"]).toBe("key");
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({
      sender: { name: "Care Bridge", email: "hi@mediq.in" },
      to: [{ email: "a@b.com" }],
      subject: "S",
      textContent: "T",
    });
  });

  it("Brevo reports its error message", async () => {
    const { impl } = fakeFetch(400, { message: "sender not valid" });
    const p = new BrevoEmailProvider("key", "hi@mediq.in", impl);
    await expect(p.send({ to: "a@b.com", subject: "S", text: "T" })).rejects.toThrow(
      new EmailError("Brevo: sender not valid"),
    );
  });

  it("Resend sends and reports errors", async () => {
    const good = fakeFetch(200, { id: "r1" });
    await expect(
      new ResendEmailProvider("k", "hi@mediq.in", good.impl).send({
        to: "a@b.com",
        subject: "S",
        text: "T",
      }),
    ).resolves.toEqual({ providerMessageId: "r1" });
    expect((good.calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer k");

    const bad = fakeFetch(403, { message: "domain not verified" });
    await expect(
      new ResendEmailProvider("k", "hi@mediq.in", bad.impl).send({
        to: "a@b.com",
        subject: "S",
        text: "T",
      }),
    ).rejects.toThrow("Resend: domain not verified");
  });
});
