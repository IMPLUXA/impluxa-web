# Runbook — DNS Rollback (Cloudflare wildcard)

**Owner:** Pablo (Impluxa)
**Last updated:** 2026-05-12
**Reviewed:** quarterly

Restores DNS resolution when the wildcard CNAME for `*.impluxa.com` (tenant subdomains) breaks or its certificate fails.

## Trigger

- Wildcard CNAME change breaking one or more tenant subdomains (e.g. `hakunamatata.impluxa.com`)
- Customer reports "no carga el sitio" or browser shows `DNS_PROBE_FINISHED_NXDOMAIN`
- Certificate validation failure on a tenant subdomain (browser shows `NET::ERR_CERT_COMMON_NAME_INVALID` or `ERR_SSL_PROTOCOL_ERROR`)
- Vercel domain verification flips from green to red
- An apex `impluxa.com` DNS record was changed and customers cannot reach the site

## Severity

| Sev      | Condition                                                     |
| -------- | ------------------------------------------------------------- |
| **Sev1** | Apex `impluxa.com` unresolvable OR all tenant subdomains down |
| **Sev2** | Single tenant subdomain down, apex working                    |
| **Sev3** | Cosmetic DNS lint warning, no customer impact                 |

## Owner

- **Primary:** Pablo (Impluxa) — owns Cloudflare account
- **Secondary:** _TBD_

## Detection

1. Customer report via WhatsApp ("no abre el sitio")
2. UptimeRobot alert on `https://impluxa.com` or `https://hakunamatata.impluxa.com` (once configured)
3. `dig hakunamatata.impluxa.com CNAME` returns NXDOMAIN or wrong target
4. Vercel Dashboard → Domains shows red verification status
5. SSL/TLS Labs scan failing (manual)

## Diagnosis

First 5 things to check:

1. **Resolution test:** `dig +short hakunamatata.impluxa.com CNAME` — expected target is the Vercel project alias (e.g. `cname.vercel-dns.com`). Compare against `dig +short impluxa.com`.
2. **Recent DNS changes:** Cloudflare Dashboard → impluxa.com → DNS → Records → check "Edited" column for last change. Cross-reference with audit log (Cloudflare → Manage Account → Audit Log).
3. **Proxy status:** Confirm the wildcard `*` CNAME is set to **DNS only** (grey cloud), NOT proxied (orange cloud). Vercel's cert provisioning requires DNS-only.
4. **Vercel domain attachment:** Vercel Dashboard → impluxa-web → Domains. The wildcard domain (or each tenant subdomain) must be attached and show "Valid Configuration".
5. **Cert status:** Browser DevTools → Security tab on the failing subdomain. Note the issuer and SAN entries. If cert lists wrong SAN, Vercel needs DNS re-verification.

## Recovery

### Sev1 — wildcard misconfigured or apex broken

1. Open Cloudflare Dashboard → **impluxa.com** → **DNS** → **Records**.
2. Locate the wildcard record: `Type: CNAME`, `Name: *`, `Target: cname.vercel-dns.com` (or the documented target).
3. Click the record → **Edit**. Revert to last known good state:
   - **Name:** `*`
   - **Target:** `cname.vercel-dns.com`
   - **Proxy status:** DNS only (grey cloud)
   - **TTL:** Auto (or 300s for fast recovery)
4. **Save**.
5. For the apex, if affected:
   - **Type:** `A` (or CNAME flattening) — confirm target matches Vercel's documented IPs in `D:\impluxa-web\docs\dns-setup.md` (if present) or Vercel → Domains → impluxa.com → "Configure".
6. Propagation expectation: **5 minutes** with TTL 300, since the record is DNS-only (no Cloudflare cache). Most resolvers update within 60s.
7. If certificate is stuck after DNS recovery, in Vercel → Domains → click the affected domain → **Refresh** to re-trigger cert provisioning.

### Sev2 — single tenant subdomain

1. Confirm wildcard CNAME is healthy (Sev1 step 2 above).
2. Vercel Dashboard → impluxa-web → **Domains** → check if the specific subdomain (e.g. `hakunamatata.impluxa.com`) is attached. If not, **Add Domain**.
3. Wait for verification (usually < 2 min when wildcard CNAME is correct).

### Customer comms (if outage > 15 min)

WhatsApp to Hakuna using the Sev1 template in `incident-response.md`.

## Verification

Run all of:

```bash
dig +short impluxa.com
dig +short hakunamatata.impluxa.com CNAME
curl -I https://impluxa.com
curl -I https://hakunamatata.impluxa.com
```

Expected:

- `dig` returns the documented Vercel target for the CNAME, not NXDOMAIN
- `curl -I` returns `HTTP/2 200` (or 3xx redirect to canonical URL)
- Browser loads each subdomain with a valid cert (Let's Encrypt via Vercel, SAN includes the subdomain)

Hold the state for 15 min before declaring recovery.

## Post-mortem

Mandatory for Sev1. Use the skeleton in `incident-response.md`. Specific questions for DNS incidents:

- Who made the DNS change? When? Was it reviewed?
- Was the previous record exported/backed up before the edit?
- Was the change tested against a single subdomain (e.g. a staging tenant) before applying to wildcard?
- Action item candidates: pin a "DNS edit checklist" in Cloudflare account notes; export DNS records to `docs/dns-snapshot.json` weekly.

## Last drill date

YYYY-MM-DD — not yet drilled
