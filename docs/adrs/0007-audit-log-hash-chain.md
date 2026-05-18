# ADR-0007: Audit log — partitioned table + SHA-256 hash chain

- **Status:** Accepted
- **Date:** 2026-05-14
- **Deciders:** Pablo (founder) + Lord Claude + consejo del arsenal (Security Engineer + Database Optimizer + Compliance Auditor)
- **Context tag:** v0.2.5 Auth Blindado Multi-Tenant, FR-AUTH-7, threat T-v025-03 (audit log mutation / tampering)

## Context

Impluxa is moving from a single-tenant landing (Hakuna) to a multi-tenant SaaS. As soon as we onboard tenants other than the founder's own, we acquire two obligations we did not have before:

1. **Forensic evidence on demand.** Tenants and (in v0.2.7+) AAIP / RGPD-style audits will ask: "show me every action a given user took, in chronological order, with no gaps and no edits." A log that the operator can silently edit is worth less than no log at all.
2. **Tamper evidence for the operator's own protection.** If a tenant accuses us of mutating their data, we need to be able to prove we did not. Conversely, if our own DB is compromised, we need to detect surreptitious edits to the audit trail rather than discover them months later.

The pre-v0.2.5 `activity_log` table was a flat insert sink with no integrity guarantees. Authenticated users could not write to it (RLS denied) but service-role inserts were trivially mutable post-hoc. There was no detection mechanism if a row was changed or removed.

We also expect non-trivial event volume (every login, role switch, tenant create, site publish, sensitive read). Without partitioning we land on a monolithic table that becomes painful to vacuum, archive, or DROP-old-partition.

## Decision

We replace `activity_log` with a **partitioned `public.audit_log`** that:

1. Is **range-partitioned by `occurred_at`** monthly. The current partition is created at migration time; a `pg_cron`-driven double-buffer rotation creates the next partition before month boundary (ADR-0006 cross-reference).
2. **Cannot be written from the client surface at all.** `INSERT/UPDATE/DELETE` are revoked from `authenticated`, `anon`, and `public`. The only insert path is the server-side `public.append_audit(jsonb)` SECURITY DEFINER function, executable by `service_role` exclusively.
3. **Computes a SHA-256 hash chain** in a `BEFORE INSERT` trigger. Each row's `record_hash` is `sha256(prev_record_hash || '|' || occurred_at || '|' || ... || metadata::text)` and is stored alongside `prev_record_hash`. Out-of-band mutation of any payload field invalidates the chain at that row.
4. **Serializes chain construction** with `pg_advisory_xact_lock(hashtext('audit_log_chain'))` rather than `SELECT ... FOR UPDATE`. Advisory locks are phantom-safe across partitions and release on transaction commit/rollback. They do not block reads.
5. **Restricts reads** via RLS: a tenant owner (role='owner' in `tenant_members`) reads their own tenant's events; a platform admin reads all; nobody else reads anything. `acting_as_tenant_id` is the key — it is set by the app server, not by the actor.

The chain payload includes every business-meaningful column (`actor_user_id`, `actor_session_id`, `acting_as_tenant_id`, `acting_as_role`, `action`, `resource_type`, `resource_id`, `ip`, `user_agent`, `request_id`, `metadata`). Null values serialize as empty strings; `metadata` serializes as canonical `jsonb::text` (Postgres lexicographic key order).

## Consequences

### Positive

- **Tamper evidence is mechanical, not policy.** An auditor (internal or external) recomputes the chain in five lines of code and verifies row-by-row. The integration test `tests/integration/audit-log-hash-chain.test.ts` does exactly this on every CI run.
- **Blast radius of a compromised client is zero for the audit table.** Even a service-role token leak only buys writes; the chain still records who/when, and out-of-band UPDATE/DELETE is detectable.
- **Monthly partitions make retention and rotation trivial.** Old partitions can be `DETACH` + archived without disturbing inserts. The double-buffer cron (ADR-0006) ensures partitions exist before they are needed; failure surfaces as a HEALTHCHECK alert, not as failed inserts.
- **`append_audit` centralizes server-side stamping.** App code passes a payload and gets ordering, hashing, and field-shape guarantees for free. There is no surface for "I forgot to write to the audit log."

### Negative

- **The chain serializes inserts.** Under concurrent load, the advisory lock funnels writes through one transaction at a time. We accept this because audit writes are not on the user-facing critical path; in practice, write volume during v0.2.5 will be in the dozens-per-minute range. If we exceed ~500 inserts/sec we revisit (e.g. per-tenant subchains).
- **Recomputing the chain in clients (JS, Python) requires exact payload byte-fidelity.** The trigger's `jsonb::text` canonicalization is not the same as `JSON.stringify`; any verifier must reuse Postgres's canonical form (read back the row, then re-serialize identically). The test suite addresses this by reading back the stored `metadata` rather than re-canonicalizing client-side.
- **`metadata` is freeform.** A large or weirdly-encoded payload (binary, non-UTF-8) bloats the chain and the hash input. We rely on app-layer schema discipline; v0.3 may add a JSON schema check at `append_audit` entry.

### Neutral / trade-offs

- **Two writes per audit event** (the row plus the chain lookup of the previous row). Acceptable for the integrity guarantee; the partition + index keep the lookup at ~one block IO.
- **Audit rows outlive their referenced tenant** (`acting_as_tenant_id` is `ON DELETE SET NULL`). This is intentional — we want forensic evidence to persist past tenant offboarding. Documented in the schema comment.

## Alternatives considered

- **Append-only log table with INSERT-only RLS, no hash chain.** Rejected: trivially mutable by service-role compromise; chain provides defense in depth without harder cryptography.
- **External WORM store (S3 Object Lock, Cloud Storage immutable buckets).** Considered for v0.4; not v0.2.5 scope. Adds operational surface (IAM, lifecycle), latency, and a second source of truth to reconcile. We can layer it later by streaming `audit_log` to S3 with Object Lock; the in-DB chain stays as the queryable source.
- **Per-tenant subchains keyed by `acting_as_tenant_id`.** Rejected for v0.2.5: doubles complexity (one HEAD pointer per tenant), and concurrency is not yet a bottleneck. Documented in "When to revisit."
- **HMAC instead of plain SHA-256.** Rejected for v0.2.5: requires server-side key management and a separate key-rotation runbook. SHA-256 is sufficient for tamper _evidence_ (anyone with the data can detect mutation); HMAC adds tamper _authentication_ (only key-holders can produce valid chains) and is on the roadmap for v0.3 if we onboard tenants with regulatory key-isolation requirements.
- **`SELECT ... FOR UPDATE` on the last row to serialize.** Rejected (DO-H2 review finding): on a partitioned table, `FOR UPDATE` against the previous row races across partitions at month boundaries. Advisory lock is monotonic and partition-agnostic.

## Implementation references

- `supabase/migrations/20260514_v025_005_audit_log.sql` — table, trigger, `append_audit` function, RLS policies.
- `supabase/migrations/20260514_v025_006_audit_partition_rotation.sql` — pg_cron double-buffer monthly partition rotation (ADR-0006 cross-references this).
- `tests/integration/audit-log-hash-chain.test.ts` (commit `b79e0cf`) — recomputes the chain client-side, verifies SHA-256 match, verifies tamper detection on out-of-band UPDATE.
- `src/lib/audit.ts` — `writeAuditEvent({...})` app-layer wrapper around `service.rpc('append_audit', ...)` (W3.G3.T1, pending).
- `docs/adrs/0006-audit-log-access-control.md` — companion ADR (partition rotation + RLS read policy).

## Verification

- `tests/integration/audit-log-hash-chain.test.ts` passes when run against the v0.2.5 preview branch with `SUPABASE_TEST_URL/ANON/SERVICE` env vars set. 3 static + 7 DB-bound assertions covering: row count, prev-pointer linkage, hash-payload byte-equivalence, tamper detection, anon-INSERT denial, RPC execute revocation.
- `supabase db lint` reports zero new security advisories on the audit_log table after migration applies.
- Smoketest in the W2 review (round 3) inserted 3 rows via `append_audit` and walked the chain manually; result `CHAIN_OK`.

## When to revisit

- **Throughput exceeds ~500 audit writes/sec.** Move to per-tenant subchains (HEAD pointer per `acting_as_tenant_id`) and a TIDB-style global-checkpoint scheme.
- **Regulatory requirement for key-bound integrity** (e.g. a tenant in a vertical that mandates HMAC or signed logs). Promote from SHA-256 to HMAC-SHA-256 with a key kept in Vault / Doppler, rotated quarterly.
- **External WORM mirror needed.** Add a streaming sink (Supabase Realtime → S3 Object Lock) and a reconciliation job that walks the in-DB chain and the WORM mirror once per day.
- **Audit volume retention exceeds 12 months.** Detach old monthly partitions to cold storage; keep the chain HEAD pointer queryable for verification.
- **Schema evolution of audit row fields.** Any new column added to `public.audit_log` MUST also be added to the hash payload format AND to client recomputers (test fixture + verifier). Mismatches break the chain silently in test, loudly in audit. Bump ADR-0007 minor revision when this happens.
