# Prompt for the scheduled routine “Atualizar pesquisas — themachineobserver.com (v3)”

You maintain the raw polling data for `https://themachineobserver.com`. The repository `marcelogarciadoo/themachineobserver-site` is checked out in your working directory and pushing to `main` is authorized. Do not edit site code or model outputs.

The live redesign reads `data/raw-polls.json`. The legacy `data/polls.json` must remain synchronized for compatibility. New raw polls are editorial evidence; adjusted estimates and Monte Carlo results are rebuilt and released separately after validation.

1. Build pending registrations from the TSE registry mirror at `https://raw.githubusercontent.com/rafaujo/eleicoes-2026-pesquisas/main/data/tse-metadata.json`. Normalize protocols as `BR-NNNNN/YYYY`. A registration is pending when it appears in neither the second-round records nor the legacy `ignored` list and its disclosure date is today or earlier in `America/Sao_Paulo`.
2. Check at most eight pending registrations per run, newest first. Prefer the institute report or contracting outlet. Secondary sources may be used only to locate or corroborate a result. Never guess.
3. Confirm institute, national presidential scope, field dates, sample size and registration. Record any explicit discrepancy in `auditNote` instead of silently changing the registered metadata.
4. Extract one documented principal stimulated first-round scenario and the Lula × Flávio Bolsonaro runoff over total respondents. Preserve blank/null/no-vote, undecided and grouped-other categories when published. Record missing categories as missing, never zero. Store the stated margin of error, confidence, method and primary source URL.
5. Append one round-1 and one round-2 record to `data/raw-polls.json`, preserving its schema. IDs must be unique and monotonically extend the existing `RAW-R1-###` and `RAW-R2-###` series. Both records must share the normalized registration, source metadata and a stable `waveId` ending in `R1` or `R2`. Keep records ordered by publication date, then ID.
6. Append the same verified runoff result to legacy `data/polls.json`. If no Lula × Flávio runoff exists, add the protocol to its `ignored` list with a short reason. If results cannot be verified, leave the protocol pending.
7. Set both artifacts’ update timestamps to today. Validate JSON, unique IDs, dates (`start <= end <= published`), percentages in 0–100, and a first-/second-round pair for every new registration. Confirm the new records are present before committing.
8. When anything changed, commit only `data/polls.json` and `data/raw-polls.json` with `polls: <institute(s)> <YYYY-MM-DD>` and push `main`. The raw-feed change triggers the complete gated recalculation. Hostinger receives the redesign's raw data, adjusted estimates, simulation and pages together only after that workflow passes; the preserved legacy page continues to receive `data/polls.json` independently.

Finish with: rows added and sources; protocols ignored and why; protocols still pending and why. If nothing changed, say so. Never publish a statistical correction or alter an adjusted/model release in this routine.
