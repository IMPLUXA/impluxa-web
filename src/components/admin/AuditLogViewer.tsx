import "server-only";

/**
 * AuditLogViewer — server component table for tenant audit log
 * (W3.G3.T4 part 2, FR-AUTH-7, D4).
 *
 * Renders rows fetched from `/api/audit?tenant=<uuid>` (W3.G3.T4 part 1).
 * Chain integrity is checked CLIENT-side via `<AuditChainStatus>` (pointer-only
 * verify — full SHA-256 recompute is in the integration test `audit-log-hash-chain.test.ts`,
 * recomputing in the browser would require shipping the trigger payload format
 * and crypto.subtle for every render — too costly for a hot admin page).
 *
 * Pointer verify alone catches: row removal, row reordering, row insertion
 * without trigger. It does NOT catch: payload mutation that re-uses the
 * same `record_hash` (which is itself only possible via a SHA-256 second
 * preimage, computationally infeasible). For full payload tampering
 * detection, run the integration test against the source-of-truth DB.
 */

import { AuditChainStatus } from "./AuditChainStatus";

export interface AuditRow {
  id: number;
  occurred_at: string;
  action: string;
  actor_user_id: string | null;
  actor_session_id: string | null;
  acting_as_tenant_id: string | null;
  acting_as_role: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: Record<string, unknown> | null;
  prev_record_hash: string | null;
  record_hash: string;
}

export interface AuditLogViewerProps {
  /** Events ordered by `occurred_at` DESC as returned by the route. */
  events: AuditRow[];
  /** Tenant whose log is being shown — for header context only. */
  tenantId: string;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function truncate(s: string | null | undefined, n = 12): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function AuditLogViewer({
  events,
  tenantId,
}: AuditLogViewerProps) {
  if (events.length === 0) {
    return (
      <section data-testid="audit-empty">
        <h2>Audit log</h2>
        <p>
          No hay eventos registrados para el tenant{" "}
          <code>{truncate(tenantId, 8)}</code>.
        </p>
      </section>
    );
  }

  // The route returns rows DESC; for chain verification we walk them in the
  // order they were inserted (oldest first). We don't mutate `events`.
  const chronological = [...events].slice().reverse();

  return (
    <section data-testid="audit-viewer">
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Audit log</h2>
        <AuditChainStatus rows={chronological} />
      </header>

      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
      >
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #262626" }}>
            <th style={th}>Cuándo</th>
            <th style={th}>Acción</th>
            <th style={th}>Actor</th>
            <th style={th}>Rol</th>
            <th style={th}>Recurso</th>
            <th style={th}>Hash</th>
          </tr>
        </thead>
        <tbody>
          {events.map((row) => (
            <tr
              key={row.id}
              style={{ borderBottom: "1px solid #1a1a1a" }}
              data-testid={`audit-row-${row.id}`}
            >
              <td style={td}>
                <time dateTime={row.occurred_at}>
                  {formatTimestamp(row.occurred_at)}
                </time>
              </td>
              <td style={{ ...td, fontFamily: "monospace" }}>{row.action}</td>
              <td style={{ ...td, fontFamily: "monospace" }}>
                {truncate(row.actor_user_id, 8)}
              </td>
              <td style={td}>{row.acting_as_role ?? "—"}</td>
              <td style={td}>
                {row.resource_type ? (
                  <>
                    <code>{row.resource_type}</code>
                    {row.resource_id ? `/${truncate(row.resource_id, 12)}` : ""}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td
                style={{ ...td, fontFamily: "monospace", color: "#737373" }}
                title={row.record_hash}
              >
                {truncate(row.record_hash, 8)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const th: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 600,
  color: "#a3a3a3",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontSize: 11,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "top",
};
