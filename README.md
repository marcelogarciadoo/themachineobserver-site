# themachineobserver.com — Brasil 2026

Source of truth for the site at https://themachineobserver.com (hosted on Hostinger, DNS/proxy on Cloudflare).

## How the site stays current

| What | Who updates it | How often |
|---|---|---|
| Kalshi / Polymarket prices → `data/kalshi.json`, `data/polymarket.json` | `cron/update_markets.php` on Hostinger (no AI) | every 30 min |
| New poll registrations at the TSE → `data/pending.json` | `cron/update_tse.php` on Hostinger (no AI) | hourly |
| Poll results → `data/polls.json` | the Claude Code routine "Atualizar pesquisas - themachineobserver.com (v2)" (bound to this repository): derives the pending list from the TSE registry mirror, finds the published numbers, validates them against the registration and commits here | every 6 h |
| `data/polls.json` in this repository → `public_html/data/polls.json` on Hostinger | `cron/sync_github.php` on Hostinger (pulls the raw file from GitHub; code files are deployed by hand) | every 10 min |

Generated files (`data/kalshi.json`, `data/polymarket.json`, `data/pending.json`, `cron/*.log`) live only on the server and are git-ignored.

## `data/polls.json`

```json
{
  "updated": "2026-09-18",          // date the sources were last checked (shown on the page)
  "version": 1,
  "notes": "Notas de fonte: ...",   // free text shown under the table
  "ignored": ["BR-01234/2026"],     // TSE registrations that will never enter the series (no Lula×Flávio runoff scenario, withdrawn, etc.)
  "polls": [
    {"pollster": "Quaest", "start": "2026-01-08", "end": "2026-01-11", "published": "2026-01-14",
     "lula": 45, "flavio": 38, "sample": 2004, "moe": 2, "registration": "BR-00835/2026",
     "source": "https://...", "methodSource": "https://... (optional)"}
  ]
}
```

Rules the routine follows (its instructions are kept in `TASK_PROMPT.md`): only national presidential second-round Lula × Flávio Bolsonaro scenarios, percentages over total respondents as published, one row per published round, `registration` must match the TSE protocol in `pending.json`, `source` must be the publication where the numbers were read. If the numbers cannot be found or verified, the registration stays pending; if the poll has no such scenario, its protocol goes to `ignored`.
