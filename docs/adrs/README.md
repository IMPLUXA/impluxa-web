# Architecture Decision Records (ADRs)

This directory tracks meaningful architectural decisions for Impluxa. We use [MADR](https://adr.github.io/madr/) format. Each record captures the **context**, the **decision**, its **consequences**, the **alternatives** we rejected, and **when to revisit**.

> **Why ADRs?** Code shows _what_ we built. ADRs explain _why_. Future-you (and the next contributor) will thank past-you for writing them.

## How to use this directory

- ADRs are numbered sequentially (`0001-`, `0002-`, ...). Never renumber.
- One file per decision. Filename: `NNNN-short-kebab-title.md`.
- Decisions are **append-only**. To change one, write a new ADR with status `Supersedes ADR-NNNN` and update the older ADR's status to `Superseded by ADR-MMMM`.
- Keep each ADR ~150-300 words of prose + concrete code references. Link to source; do not copy it.

## Status legend

- **Proposed** — under discussion, not yet implemented.
- **Accepted** — implemented and in use.
- **Deprecated** — no longer the recommendation; existing code may still rely on it.
- **Superseded** — replaced by a newer ADR (link required).

## Index

| ID                                            | Title                                      | Status   | Date       | Topic         |
| --------------------------------------------- | ------------------------------------------ | -------- | ---------- | ------------- |
| [ADR-0001](./0001-host-based-routing.md)      | Host-based routing via middleware rewrites | Accepted | 2026-05-11 | Routing       |
| [ADR-0002](./0002-template-module-pattern.md) | Template module pattern with Zod schemas   | Accepted | 2026-05-11 | Templates     |
| [ADR-0003](./0003-rls-split-policies.md)      | RLS split policies + `is_admin()` helper   | Accepted | 2026-05-11 | Security / DB |
| [ADR-0004](./0004-supabase-ssr-cookies.md)    | `@supabase/ssr` cookie-based session       | Accepted | 2026-05-11 | Auth          |

## Writing a new ADR

1. Copy an existing file as a template.
2. Increment the number.
3. Fill out every section — especially **Alternatives considered** and **When to revisit**. If you can't name an alternative, you have not thought hard enough.
4. Add it to the index above in the same PR as the code that implements it.
5. Reference the ADR in the relevant code (`// See ADR-0003 for the rationale.`) where it would help a future reader.
