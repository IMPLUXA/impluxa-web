import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  encryptToken,
  decryptToken,
  toBytea,
  fromBytea,
} from "@/lib/mp/crypto";

// ============================================================================
// Repositorio de credenciales OAuth MercadoPago por-tenant (F2 build MP s55).
//
// ÚNICA vía de acceso a public.tenant_mp_credentials (tabla service-role-only,
// RLS niega a authenticated/anon — ver v030_005). Usa el service client y cifra
// /descifra los tokens app-level. NUNCA devuelve el token a un cliente: los
// callers de esta capa son server-side (callback OAuth, creador de preferencia,
// webhook). El estado legible-por-dueño se sirve por la RPC mp_connection_status
// (v030_006), que jamás toca el ciphertext.
// ============================================================================

const TABLE = "tenant_mp_credentials";

export type MpTokens = {
  accessToken: string;
  refreshToken: string;
  mpUserId: string | null;
  scope: string | null;
  expiresAt: string; // ISO — vencimiento del access_token (now + 180d)
  refreshExpiresAt: string | null; // ISO — vencimiento del refresh (now + 6m) si MP lo informa
};

/** Upsert (1 conexión por tenant). Cifra ambos tokens en una sola escritura atómica. */
export async function upsertMpCredentials(
  tenantId: string,
  t: MpTokens,
): Promise<void> {
  const sb = getSupabaseServiceClient();
  const acc = encryptToken(t.accessToken);
  const ref = encryptToken(t.refreshToken);
  const now = new Date().toISOString();
  const { error } = await sb.from(TABLE).upsert(
    {
      tenant_id: tenantId,
      mp_user_id: t.mpUserId,
      access_token_ciphertext: toBytea(acc.ciphertext),
      access_token_nonce: toBytea(acc.nonce),
      refresh_token_ciphertext: toBytea(ref.ciphertext),
      refresh_token_nonce: toBytea(ref.nonce),
      key_version: acc.keyVersion,
      scope: t.scope,
      expires_at: t.expiresAt,
      refresh_expires_at: t.refreshExpiresAt,
      status: "connected",
      last_refresh_at: now,
      updated_at: now,
    },
    { onConflict: "tenant_id" },
  );
  // El error NO debe incluir el token; supabase error.message no lo contiene.
  if (error) throw new Error(`mp-credentials: upsert falló (${error.message})`);
}

/** Devuelve el access_token descifrado del tenant, o null si no conectó / no activo. */
export async function getMpAccessToken(tenantId: string): Promise<{
  accessToken: string;
  expiresAt: string;
  mpUserId: string | null;
} | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "access_token_ciphertext, access_token_nonce, key_version, expires_at, mp_user_id, status",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error)
    throw new Error(`mp-credentials: lectura falló (${error.message})`);
  if (!data || data.status !== "connected") return null;
  const accessToken = decryptToken(
    fromBytea(data.access_token_ciphertext as string),
    fromBytea(data.access_token_nonce as string),
    data.key_version as number,
  );
  return {
    accessToken,
    expiresAt: data.expires_at as string,
    mpUserId: (data.mp_user_id as string | null) ?? null,
  };
}

/** Devuelve el refresh_token descifrado (para el flujo de renovación). server-side only. */
export async function getMpRefreshToken(
  tenantId: string,
): Promise<{ refreshToken: string; keyVersion: number } | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "refresh_token_ciphertext, refresh_token_nonce, key_version, status",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error)
    throw new Error(`mp-credentials: lectura falló (${error.message})`);
  if (!data) return null;
  const refreshToken = decryptToken(
    fromBytea(data.refresh_token_ciphertext as string),
    fromBytea(data.refresh_token_nonce as string),
    data.key_version as number,
  );
  return { refreshToken, keyVersion: data.key_version as number };
}

/** Marca el estado de conexión (expired/revoked) sin tocar el ciphertext.
 *  Re-`connected` legítimo es SOLO vía upsertMpCredentials (con tokens frescos)
 *  → el tipo excluye 'connected' a propósito (Two-Pass cold INFO-3). */
export async function setMpStatus(
  tenantId: string,
  status: "expired" | "revoked",
): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);
  if (error)
    throw new Error(`mp-credentials: setStatus falló (${error.message})`);
}
