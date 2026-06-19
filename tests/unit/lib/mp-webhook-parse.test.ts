import { describe, expect, it } from "vitest";
import {
  parseNotification,
  parseExternalReference,
  classifyMpStatus,
} from "@/lib/mp/webhook-parse";

describe("parseNotification", () => {
  it("topic 'type'=payment, data.id de query preferente sobre body", () => {
    const r = parseNotification(
      { type: "payment", data: { id: "111" }, user_id: 182102575 },
      "999", // query (firmado) → preferente
    );
    expect(r.topic).toBe("payment");
    expect(r.dataId).toBe("999");
    expect(r.userId).toBe("182102575"); // number → string
  });

  it("usa 'topic' si 'type' ausente; data.id del body si no hay query", () => {
    const r = parseNotification(
      { topic: "payment", data: { id: "abc" } },
      null,
    );
    expect(r.topic).toBe("payment");
    expect(r.dataId).toBe("abc");
    expect(r.userId).toBeNull();
  });

  it("tolera body null", () => {
    const r = parseNotification(null, "555");
    expect(r.topic).toBeNull();
    expect(r.dataId).toBe("555");
    expect(r.userId).toBeNull();
    expect(r.extRefTenantId).toBeNull();
  });

  it("extRefTenantId solo si la notif trajera external_reference con ':' (fallback no-estándar)", () => {
    const r = parseNotification(
      { type: "payment", external_reference: "tenant-x:reserva-y" },
      "1",
    );
    expect(r.extRefTenantId).toBe("tenant-x");
  });

  it("data.id alternativo en b['data.id']", () => {
    const r = parseNotification({ "data.id": "777", type: "payment" }, null);
    expect(r.dataId).toBe("777");
  });
});

describe("parseExternalReference", () => {
  it("formato tenant:reserva", () => {
    expect(parseExternalReference("t-1:r-2")).toEqual({
      tenantId: "t-1",
      reservaId: "r-2",
    });
  });
  it("legacy solo-reservaId", () => {
    expect(parseExternalReference("r-solo")).toEqual({
      tenantId: null,
      reservaId: "r-solo",
    });
  });
  it("null/vacío", () => {
    expect(parseExternalReference(null)).toEqual({
      tenantId: null,
      reservaId: null,
    });
    expect(parseExternalReference("   ")).toEqual({
      tenantId: null,
      reservaId: null,
    });
  });
  it("uuid real con guiones NO se parte de más (solo el primer ':')", () => {
    // los uuid no tienen ':'; el split por ':' es seguro
    const r = parseExternalReference(
      "2878495a-edba-4699-b961-2bb93d214bf5:abc-def",
    );
    expect(r.tenantId).toBe("2878495a-edba-4699-b961-2bb93d214bf5");
    expect(r.reservaId).toBe("abc-def");
  });
});

describe("classifyMpStatus", () => {
  it("approved/rejected/cancelled → confirm con el rpcStatus", () => {
    expect(classifyMpStatus("approved")).toEqual({
      action: "confirm",
      rpcStatus: "approved",
    });
    expect(classifyMpStatus("rejected")).toEqual({
      action: "confirm",
      rpcStatus: "rejected",
    });
    expect(classifyMpStatus("cancelled")).toEqual({
      action: "confirm",
      rpcStatus: "cancelled",
    });
  });
  it("pending/in_process/authorized → ignore (transitorio)", () => {
    for (const s of ["pending", "in_process", "authorized"]) {
      expect(classifyMpStatus(s)).toEqual({ action: "ignore", status: s });
    }
  });
  it("refunded/charged_back/in_mediation → deadletter unhandled (D1, sin reversa)", () => {
    for (const s of ["refunded", "charged_back", "in_mediation"]) {
      expect(classifyMpStatus(s)).toEqual({
        action: "deadletter",
        reason: `unhandled_status:${s}`,
      });
    }
  });
  it("desconocido/null → deadletter (visible, no silencio)", () => {
    expect(classifyMpStatus("rarísimo")).toEqual({
      action: "deadletter",
      reason: "unknown_status:rarísimo",
    });
    expect(classifyMpStatus(null)).toEqual({
      action: "deadletter",
      reason: "unknown_status:null",
    });
  });
});
