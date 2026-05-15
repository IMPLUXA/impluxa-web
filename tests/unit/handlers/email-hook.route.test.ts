import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { verifyMock, sendEmailMock, renderMock, writeAuditMock } = vi.hoisted(
  () => ({
    verifyMock: vi.fn(),
    sendEmailMock: vi.fn(),
    renderMock: vi.fn(),
    writeAuditMock: vi.fn(),
  }),
);

vi.mock("standardwebhooks", () => ({
  Webhook: class {
    constructor(_secret: string) {}
    verify = verifyMock;
  },
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendEmailMock };
    constructor(_apiKey: string) {}
  },
}));

vi.mock("@react-email/render", () => ({
  render: renderMock,
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditEvent: writeAuditMock,
}));

process.env.SEND_EMAIL_HOOK_SECRET = "v1,whsec_test-secret";
process.env.RESEND_API_KEY = "re_test_key";

const { POST } = await import("@/app/api/auth/email-hook/route");

function mkPost(body: unknown, headers: Record<string, string> = {}) {
  const json = JSON.stringify(body);
  return {
    text: async () => json,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  verifyMock.mockReset();
  sendEmailMock
    .mockReset()
    .mockResolvedValue({ data: { id: "msg_123" }, error: null });
  renderMock.mockReset().mockResolvedValue("<html>...</html>");
  writeAuditMock.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/email-hook (W3.G3.T3, FR-AUTH-3, D16)", () => {
  it("returns 401 when webhook signature verification fails", async () => {
    verifyMock.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const res = await POST(
      mkPost(
        {},
        {
          "webhook-id": "id",
          "webhook-signature": "bad",
          "webhook-timestamp": "0",
        },
      ),
    );
    expect(res.status).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 500 when SEND_EMAIL_HOOK_SECRET env is missing", async () => {
    const prev = process.env.SEND_EMAIL_HOOK_SECRET;
    delete process.env.SEND_EMAIL_HOOK_SECRET;
    const res = await POST(mkPost({}));
    expect(res.status).toBe(500);
    process.env.SEND_EMAIL_HOOK_SECRET = prev;
  });

  it("sends magic-link email via Resend when payload action is magiclink", async () => {
    verifyMock.mockReturnValueOnce({});
    const payload = {
      user: {
        email: "rey@impluxa.com",
        id: "00000000-0000-0000-0000-000000000fff",
      },
      email_data: {
        email_action_type: "magiclink",
        token: "482913",
        token_hash: "hashed",
        redirect_to: "/app/dashboard",
        site_url: "https://impluxa.com",
      },
    };

    const res = await POST(
      mkPost(payload, {
        "webhook-id": "wh_1",
        "webhook-signature": "v1,sig",
        "webhook-timestamp": "1700000000",
      }),
    );

    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledOnce();
    const sendArgs = sendEmailMock.mock.calls[0][0];
    expect(sendArgs.from).toMatch(/auth@.*impluxa/i);
    expect(sendArgs.to).toBe("rey@impluxa.com");
    expect(sendArgs.subject).toMatch(/c[oó]digo|impluxa/i);
    expect(sendArgs.react).toBeTruthy();
  });

  it("audits action=email.otp_sent on successful magiclink send", async () => {
    verifyMock.mockReturnValueOnce({});
    await POST(
      mkPost(
        {
          user: {
            email: "rey@impluxa.com",
            id: "00000000-0000-0000-0000-000000000fff",
          },
          email_data: {
            email_action_type: "magiclink",
            token: "482913",
            token_hash: "hashed",
            redirect_to: "/app/dashboard",
            site_url: "https://impluxa.com",
          },
        },
        {
          "webhook-id": "wh_2",
          "webhook-signature": "v1,sig",
          "webhook-timestamp": "1700000000",
        },
      ),
    );

    expect(writeAuditMock).toHaveBeenCalledOnce();
    const event = writeAuditMock.mock.calls[0][0];
    expect(event.action).toBe("email.otp_sent");
    expect(event.actor_user_id).toBe("00000000-0000-0000-0000-000000000fff");
    expect(event.resource_type).toBe("auth_email");
  });

  it("returns 200 noop when action type is unknown (e.g. signup, recovery)", async () => {
    verifyMock.mockReturnValueOnce({});
    const res = await POST(
      mkPost(
        {
          user: {
            email: "rey@impluxa.com",
            id: "00000000-0000-0000-0000-000000000fff",
          },
          email_data: {
            email_action_type: "signup",
            token: "x",
            token_hash: "h",
          },
        },
        {
          "webhook-id": "wh_3",
          "webhook-signature": "v1,sig",
          "webhook-timestamp": "1700000000",
        },
      ),
    );

    expect(res.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 502 when Resend returns an error", async () => {
    verifyMock.mockReturnValueOnce({});
    sendEmailMock.mockResolvedValueOnce({
      data: null,
      error: { message: "rate limit" },
    });

    const res = await POST(
      mkPost(
        {
          user: {
            email: "rey@impluxa.com",
            id: "00000000-0000-0000-0000-000000000fff",
          },
          email_data: {
            email_action_type: "magiclink",
            token: "x",
            token_hash: "h",
          },
        },
        {
          "webhook-id": "wh_4",
          "webhook-signature": "v1,sig",
          "webhook-timestamp": "1700000000",
        },
      ),
    );

    expect(res.status).toBe(502);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("does NOT leak the OTP token in any response body", async () => {
    verifyMock.mockReturnValueOnce({});
    const res = await POST(
      mkPost(
        {
          user: {
            email: "rey@impluxa.com",
            id: "00000000-0000-0000-0000-000000000fff",
          },
          email_data: {
            email_action_type: "magiclink",
            token: "SECRET-OTP-482913",
            token_hash: "h",
          },
        },
        {
          "webhook-id": "wh_5",
          "webhook-signature": "v1,sig",
          "webhook-timestamp": "1700000000",
        },
      ),
    );
    const body = await res.text();
    expect(body).not.toContain("SECRET-OTP-482913");
  });
});
