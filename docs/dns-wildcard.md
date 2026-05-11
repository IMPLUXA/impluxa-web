# DNS Wildcard `*.impluxa.com` → Vercel

## Configuración requerida

### Vercel Dashboard

- Proyecto: `impluxa-web`
- Ir a Settings → Domains → Add
- Agregar: `*.impluxa.com`
- Vercel devuelve CNAME target: `cname.vercel-dns.com`

### Cloudflare DNS

- Type: `CNAME`
- Name: `*`
- Target: `cname.vercel-dns.com`
- Proxy: DNS only (nube gris — **no proxied**)

### Verificar

```bash
curl -I https://hakunamatata.impluxa.com
# Esperado: 200 OK con TLS válido
```

TLS provisioning tarda ~5-10 min tras configurar.

## Variables de entorno necesarias en Vercel

```
NEXT_PUBLIC_APP_HOST=app.impluxa.com
NEXT_PUBLIC_ADMIN_HOST=admin.impluxa.com
NEXT_PUBLIC_TENANT_HOST_SUFFIX=.impluxa.com
```
