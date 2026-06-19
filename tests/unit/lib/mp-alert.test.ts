import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { sendMpWebhookAlert } from "@/lib/mp/alert";

const BOT = "TELEGRAM_BOT_TOKEN";
const CHAT = "TELEGRAM_ALERT_CHAT_ID";

describe("sendMpWebhookAlert (fail-soft)", () => {
  beforeEach(() => {
    delete process.env[BOT];
    delete process.env[CHAT];
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env[BOT];
    delete process.env[CHAT];
  });

  it("sin envs → no-op, NO llama fetch, NO tira", async () => {
    const f = vi.fn();
    global.fetch = f as unknown as typeof fetch;
    await expect(
      sendMpWebhookAlert({ reason: "token_unauthorized", dataId: "9" }),
    ).resolves.toBeUndefined();
    expect(f).not.toHaveBeenCalled();
  });

  it("con envs → POST a la API de Telegram con chat_id + text (sin token en el body)", async () => {
    process.env[BOT] = "bot-secret-123";
    process.env[CHAT] = "555";
    const f = vi.fn(async () => ({ ok: true, status: 200 }));
    global.fetch = f as unknown as typeof fetch;
    await sendMpWebhookAlert({
      reason: "unhandled_status:refunded",
      dataId: "9",
      tenantId: "t-1",
      mpUserId: "182102575",
      paymentStatus: "refunded",
    });
    expect(f).toHaveBeenCalledOnce();
    const [u, opts] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(u).toContain("api.telegram.org/botbot-secret-123/sendMessage");
    const body = JSON.parse(opts.body as string);
    expect(body.chat_id).toBe("555");
    expect(body.text).toContain("unhandled_status:refunded");
    expect(body.text).toContain("182102575");
  });

  it("fetch falla → NO tira (fail-soft)", async () => {
    process.env[BOT] = "x";
    process.env[CHAT] = "y";
    global.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    await expect(
      sendMpWebhookAlert({ reason: "x", dataId: "1" }),
    ).resolves.toBeUndefined();
  });

  it("Telegram responde !ok → NO tira", async () => {
    process.env[BOT] = "x";
    process.env[CHAT] = "y";
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
    })) as unknown as typeof fetch;
    await expect(
      sendMpWebhookAlert({ reason: "x", dataId: "1" }),
    ).resolves.toBeUndefined();
  });
});
