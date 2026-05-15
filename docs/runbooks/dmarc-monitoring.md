# Runbook — DMARC monitoring + warmup to enforcement

> Operational watch for the DMARC reports inbox during the 2-week warmup
> window before upgrading from `p=none` to `p=quarantine; pct=10`.

> Deployed: 2026-05-15 (sesión 6ª decision #32). Records live in Cloudflare
> zone impluxa.com. Review window: 2026-05-15 → 2026-05-29.

## Records under monitoring

| name                      | type | content                                                                     | record id (Cloudflare)             |
| ------------------------- | ---- | --------------------------------------------------------------------------- | ---------------------------------- |
| `mail.impluxa.com`        | TXT  | `v=spf1 include:amazonses.com ~all`                                         | `868065f94e318c37117af5b1b60cee16` |
| `_dmarc.mail.impluxa.com` | TXT  | `v=DMARC1; p=none; rua/ruf=mailto:dmarc@impluxa.com; fo=1; adkim=r; aspf=r` | `60a376273b875d0a194e27d88ea2f2e8` |
| `_dmarc.impluxa.com`      | TXT  | `v=DMARC1; p=none; rua=mailto:dmarc@impluxa.com; adkim=r; aspf=r`           | `30e3f56ef0fdb3a3cac9dd2abb5d9b74` |

TTL: 300s (warmup). Bumped to 3600s after 7 days clean.

## Inbox `dmarc@impluxa.com`

This mailbox receives aggregate DMARC reports (XML attachments) from
participating receivers (Gmail, Outlook/Microsoft, Yahoo, etc.) every 24h.
Optional forensic reports (`ruf=`) arrive per-failure.

**Setup REQUIRED before reports arrive useful:**

1. Confirm `dmarc@impluxa.com` is a real mailbox or alias that forwards somewhere readable.
2. If alias only — set up forward to a Rey-readable inbox (Gmail, Outlook personal).
3. If you want parsing — use a free DMARC analyzer (Postmark DMARC Digest, dmarcian, EasyDMARC free tier). Otherwise eyeball the XML.

Status as of 2026-05-15: **mailbox status NOT VERIFIED** — TODO before cron schedule (below) becomes useful. If `dmarc@impluxa.com` does not exist as a deliverable mailbox, the reports get bounced and the data is lost.

## Weekly watch checklist (every Monday 2026-05-15 → 2026-05-29)

Run `cron \LordClaudeDmarcReview` (TODO setup, parallel to `\LordClaudeHeartbeat`):

```python
# C:\impluxa-utils\dmarc-monitor\monitor.py
# - IMAP login to dmarc@impluxa.com
# - Pull XML attachments from past 7 days
# - Parse: count of pass/fail by receiver
# - Send summary to Rey via Telegram OR write to D:/segundo-cerebro/wiki/meta/dmarc-weekly-<date>.md
```

Manual fallback if cron not yet set up: open inbox + skim XML manually.

## Decision tree at end of warmup window (2026-05-29)

| % messages with `spf=pass` AND `dkim=pass` AND `dmarc=pass` | Action                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **>99%**                                                    | Upgrade DMARC to `p=quarantine; pct=10`. Monitor 1 more week. If still clean → `p=quarantine; pct=100`. After 1 month clean at quarantine → `p=reject; pct=10` warmup.                                                           |
| **95-99%**                                                  | Investigate failed senders. Likely a misconfigured forwarder or a third-party service sending as `*@mail.impluxa.com` without SPF authorization. Add to SPF if legitimate, leave failing if rogue. NO policy upgrade until 99%+. |
| **<95%**                                                    | DO NOT upgrade. Investigate with deliverability specialist. Likely SPF mis-aligned or DKIM signing gap. Stay at `p=none`.                                                                                                        |

## Upgrade procedure (when ready)

```bash
# Cloudflare API PATCH the existing _dmarc.mail.impluxa.com record
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/60a376273b875d0a194e27d88ea2f2e8" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"TXT","name":"_dmarc.mail.impluxa.com","content":"v=DMARC1; p=quarantine; pct=10; rua/ruf=mailto:dmarc@impluxa.com; fo=1; adkim=r; aspf=r","ttl":300,"proxied":false}'
```

Same procedure for root `_dmarc.impluxa.com` (record id `30e3f56ef0fdb3a3cac9dd2abb5d9b74`).

Bump TTL to 3600s after 1 week at new policy without rollback.

## Rollback (if magic link delivery degrades after upgrade)

```bash
# PATCH back to p=none
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/60a376273b875d0a194e27d88ea2f2e8" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"TXT","name":"_dmarc.mail.impluxa.com","content":"v=DMARC1; p=none; rua/ruf=mailto:dmarc@impluxa.com; fo=1; adkim=r; aspf=r","ttl":300,"proxied":false}'
```

Propagation: TTL 300s → restoration <5 min. Smoketest magic link to Outlook + Gmail post-rollback.

## Anti-patterns

- **Skip warmup window** and jump from `p=none` to `p=reject` → magic links go to spam folder bulk.
- **Upgrade with `pct=100`** on first quarantine policy → blast radius too wide if config wrong.
- **Forget to add legit third-party senders to SPF** → upgrade quarantines magic links from those services. Examples: transactional newsletter, ticketing app sending as `*@impluxa.com`.
- **Lose access to `dmarc@impluxa.com` mailbox** → reports bounce silently, decision data missing, blind upgrade.

## References

- Decision #32 sesión 6ª 2026-05-15 — record creation + 8 caveats Security Engineer applied
- ADR-0008 SMTP Resend native + Send Email Hook disabled (broader email infra context)
- DevOps Automator agentId `a6f49399ea6777e91` (record content recommendation)
- Security Engineer agentId `a6db22e9f94008b39` (NO-GRAVE sign-off + caveats)
- Cloudflare API auth: `lord-claude.credentials` `CLOUDFLARE_API_TOKEN_DNS_IMPLUXA` + `CLOUDFLARE_ZONE_ID_IMPLUXA`
