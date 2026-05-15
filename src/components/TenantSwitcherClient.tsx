"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface TenantOption {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
}

export interface TenantSwitcherClientProps {
  tenants: TenantOption[];
  activeTenantId: string | null;
}

/**
 * Client component that handles the active-tenant switch flow:
 *   1. POST /api/tenant/switch with {tenant_id}
 *   2. On 200: call supabase.auth.refreshSession() so the next JWT carries
 *      the new active_tenant_id claim (Custom Access Token Hook reads
 *      user_session_state at token-issue time)
 *   3. router.push(result.redirectTo) — usually /t/<slug>/dashboard
 *
 * Per ADR-0005 §3 the refreshSession() step is non-negotiable: without it,
 * the user keeps their old JWT and RLS v2 would still filter by the old
 * active_tenant_id.
 */
export function TenantSwitcherClient({
  tenants,
  activeTenantId,
}: TenantSwitcherClientProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const active = tenants.find((t) => t.id === activeTenantId) ?? tenants[0];

  async function handleSwitch(tenantId: string) {
    if (tenantId === activeTenantId) {
      setOpen(false);
      return;
    }
    setError(null);
    setOpen(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/tenant/switch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `HTTP ${res.status}`);
          return;
        }

        const { redirectTo } = (await res.json()) as { redirectTo: string };

        // CRITICAL: refresh the session so the next request carries a JWT
        // minted with the new active_tenant_id claim. Without this, RLS v2
        // keeps filtering by the previous tenant.
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.refreshSession();

        router.push(redirectTo);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "unknown error");
      }
    });
  }

  return (
    <div style={wrapper} data-testid="tenant-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={trigger}
        disabled={pending}
      >
        <span aria-hidden style={avatar}>
          {active.name.charAt(0).toUpperCase()}
        </span>
        <span style={triggerLabel}>
          <span style={triggerTenant}>{active.name}</span>
          <span style={triggerRole}>
            {active.role}
            {active.status === "draft" ? " · borrador" : ""}
          </span>
        </span>
        <span aria-hidden style={chevron}>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <ul role="listbox" style={listbox} data-testid="tenant-switcher-list">
          {tenants.map((t) => {
            const isActive = t.id === activeTenantId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSwitch(t.id)}
                  style={isActive ? { ...option, ...optionActive } : option}
                  disabled={pending}
                  data-testid={`tenant-option-${t.slug}`}
                >
                  <span style={avatar}>{t.name.charAt(0).toUpperCase()}</span>
                  <span style={optionLabel}>
                    <span style={optionTenant}>{t.name}</span>
                    <span style={optionRole}>
                      {t.role} · {t.status}
                    </span>
                  </span>
                  {isActive && (
                    <span aria-hidden style={check}>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" style={errorBox} data-testid="tenant-switcher-error">
          No pudimos cambiar de tenant: {error}
        </p>
      )}
    </div>
  );
}

const wrapper: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
};
const trigger: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid #262626",
  borderRadius: 8,
  color: "#fafafa",
  cursor: "pointer",
};
const triggerLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  textAlign: "left",
  lineHeight: 1.2,
};
const triggerTenant: React.CSSProperties = { fontSize: 13, fontWeight: 600 };
const triggerRole: React.CSSProperties = { fontSize: 11, color: "#a3a3a3" };
const chevron: React.CSSProperties = { fontSize: 10, color: "#a3a3a3" };
const avatar: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "#171717",
  color: "#fafafa",
  fontSize: 13,
  fontWeight: 700,
};
const listbox: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  minWidth: 240,
  margin: 0,
  padding: 4,
  background: "#0a0a0a",
  border: "1px solid #262626",
  borderRadius: 8,
  listStyle: "none",
  zIndex: 50,
};
const option: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  color: "#fafafa",
  textAlign: "left",
  cursor: "pointer",
};
const optionActive: React.CSSProperties = { background: "#171717" };
const optionLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  lineHeight: 1.2,
};
const optionTenant: React.CSSProperties = { fontSize: 13, fontWeight: 600 };
const optionRole: React.CSSProperties = { fontSize: 11, color: "#a3a3a3" };
const check: React.CSSProperties = { fontSize: 14, color: "#4ade80" };
const errorBox: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#fca5a5",
};
