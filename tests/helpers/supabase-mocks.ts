/**
 * Reusable mock builders for Supabase SSR client, service client, and auth.users.
 * Import in handler tests to reduce boilerplate.
 */

import { vi } from "vitest";

/** Builds a chainable Supabase query mock that resolves to `result` for any table. */
export function buildQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "single",
    "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal methods return a promise
  (chain["single"] as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  (chain["maybeSingle"] as ReturnType<typeof vi.fn>).mockResolvedValue(result);

  // Non-terminal methods also need to resolve for await usages (Promise.all)
  for (const m of ["select", "insert", "update", "delete", "eq", "neq"]) {
    (chain[m] as ReturnType<typeof vi.fn>).mockReturnValue({
      ...chain,
      then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
    });
  }

  return chain;
}

/** Builds a minimal Supabase server client mock with controllable auth.getUser. */
export function buildServerClientMock(user: unknown = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockReturnValue(buildQueryChain({ data: null, error: null })),
  };
}

/** Builds a minimal Supabase service client mock. */
export function buildServiceClientMock(
  fromChain?: Record<string, unknown>,
  authAdmin?: Record<string, unknown>,
) {
  return {
    from: vi
      .fn()
      .mockReturnValue(
        fromChain ?? buildQueryChain({ data: null, error: null }),
      ),
    auth: {
      admin: authAdmin ?? {
        listUsers: vi
          .fn()
          .mockResolvedValue({ data: { users: [] }, error: null }),
        inviteUserByEmail: vi.fn().mockResolvedValue({
          data: { user: { id: "invited-user-id" } },
          error: null,
        }),
      },
    },
  };
}

/** A valid admin user fixture. */
export const ADMIN_USER = {
  id: "admin-uuid",
  email: "admin@impluxa.com",
  app_metadata: { role: "admin" },
};

/** A valid regular user fixture. */
export const REGULAR_USER = {
  id: "user-uuid",
  email: "user@example.com",
  app_metadata: { role: "editor" },
};

/** A valid tenant_id UUID fixture (RFC 4122 v4 compliant). */
export const TENANT_ID = "550e8400-e29b-41d4-a716-446655440000";
