"use client";

import { useMemo } from "react";

interface ChainRow {
  id: number;
  prev_record_hash: string | null;
  record_hash: string;
}

export interface AuditChainStatusProps {
  /** Rows ordered chronologically ASC (oldest first). */
  rows: ChainRow[];
}

/**
 * Verifies that each row's `prev_record_hash` equals the previous row's
 * `record_hash`. Pointer-only check — does NOT recompute SHA-256 payload
 * (that's the job of the integration test `audit-log-hash-chain.test.ts`,
 * server-side). Catches: row removal, reordering, insertion without trigger.
 *
 * Returns a small badge: ✓ verde si chain íntegra, ⚠️ amarillo si roto.
 */
export function AuditChainStatus({ rows }: AuditChainStatusProps) {
  const status = useMemo(() => {
    if (rows.length === 0) return { ok: true, brokenAt: null as number | null };
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].prev_record_hash !== rows[i - 1].record_hash) {
        return { ok: false, brokenAt: rows[i].id };
      }
    }
    return { ok: true, brokenAt: null as number | null };
  }, [rows]);

  if (status.ok) {
    return (
      <span
        data-testid="chain-ok"
        title={`Cadena íntegra: ${rows.length} eventos`}
        style={badgeOk}
      >
        ✓ Cadena íntegra
      </span>
    );
  }

  return (
    <span
      data-testid="chain-broken"
      title={`Eslabón roto en row id=${status.brokenAt}`}
      style={badgeBroken}
    >
      ⚠️ Cadena rota en #{status.brokenAt}
    </span>
  );
}

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
};

const badgeOk: React.CSSProperties = {
  ...badgeBase,
  background: "#022c22",
  color: "#4ade80",
  border: "1px solid #166534",
};

const badgeBroken: React.CSSProperties = {
  ...badgeBase,
  background: "#3f1d1d",
  color: "#fca5a5",
  border: "1px solid #991b1b",
};
