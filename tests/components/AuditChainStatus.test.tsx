import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditChainStatus } from "@/components/admin/AuditChainStatus";

function row(
  id: number,
  prev: string | null,
  hash: string,
): { id: number; prev_record_hash: string | null; record_hash: string } {
  return { id, prev_record_hash: prev, record_hash: hash };
}

describe("AuditChainStatus (W3.G3.T4 part 2 — pointer verify)", () => {
  it("renders 'cadena íntegra' for an empty list", () => {
    render(<AuditChainStatus rows={[]} />);
    expect(screen.getByTestId("chain-ok")).toBeTruthy();
  });

  it("renders 'cadena íntegra' for a valid chain", () => {
    const rows = [
      row(1, null, "aaa"),
      row(2, "aaa", "bbb"),
      row(3, "bbb", "ccc"),
    ];
    render(<AuditChainStatus rows={rows} />);
    expect(screen.getByTestId("chain-ok")).toBeTruthy();
  });

  it("renders 'cadena rota' when a row's prev_record_hash does not link", () => {
    const rows = [
      row(10, null, "aaa"),
      row(11, "aaa", "bbb"),
      row(12, "XXX_TAMPERED", "ccc"),
    ];
    render(<AuditChainStatus rows={rows} />);
    const badge = screen.getByTestId("chain-broken");
    expect(badge.textContent).toContain("#12");
  });

  it("reports the FIRST broken link only", () => {
    const rows = [
      row(20, null, "aaa"),
      row(21, "BAD", "bbb"),
      row(22, "ALSO_BAD", "ccc"),
    ];
    render(<AuditChainStatus rows={rows} />);
    expect(screen.getByTestId("chain-broken").textContent).toContain("#21");
  });

  it("single-row chain is always integral (genesis pointer can be anything)", () => {
    render(<AuditChainStatus rows={[row(1, "anything-prior-or-null", "x")]} />);
    expect(screen.getByTestId("chain-ok")).toBeTruthy();
  });
});
