import { describe, it, expect, vi, beforeEach } from "vitest";
import { ADMIN_USER, REGULAR_USER } from "../helpers/supabase-mocks";

// ── next/navigation mock ──────────────────────────────────────────────────────
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// ── Supabase server client mock ───────────────────────────────────────────────
const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
  }),
}));

const { requireUser, requireAdmin } = await import("@/lib/auth/guard");

describe("requireUser", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("returns user when authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: REGULAR_USER } });
    const user = await requireUser();
    expect(user).toEqual(REGULAR_USER);
  });

  it("redirects to /login when user is null", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when user is undefined", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: undefined } });
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("returns admin user when role is admin", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: ADMIN_USER } });
    const user = await requireAdmin();
    expect(user).toEqual(ADMIN_USER);
  });

  it("redirects to /login?error=forbidden when user is authenticated but not admin", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: REGULAR_USER } });
    await expect(requireAdmin()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=forbidden",
    );
    expect(redirectMock).toHaveBeenCalledWith("/login?error=forbidden");
  });

  it("redirects to /login when user has no app_metadata", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "id", email: "u@e.com", app_metadata: {} } },
    });
    await expect(requireAdmin()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=forbidden",
    );
  });

  it("redirects to /login when user is null (unauthenticated)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("does NOT call redirect when admin user is authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: ADMIN_USER } });
    await requireAdmin();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
