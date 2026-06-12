// Custom domain -> tenant slug. SINGLE source of truth for admin-routing
// (middleware) and login/basePath awareness (urls.ts, C2). Pure literal with
// ZERO imports: the edge middleware imports this file directly, so it must
// stay dependency-free (SE H2 gate — adding any import here breaks the edge
// bundle contract). The PUBLIC tree keeps resolving via tenants.custom_domain
// in DB; this map governs ONLY the admin/login surfaces (ADMIN-AR-MIGRATION).
export const CUSTOM_DOMAIN_TENANTS: Record<string, string> = {
  "patagoniaviva.ar": "patagoniaviva",
};
