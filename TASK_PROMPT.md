# Prompt for the scheduled Claude routine "Atualizar pesquisas - themachineobserver.com"

You maintain the poll table of https://themachineobserver.com. The repository marcelogarciadoo/themachineobserver-site is checked out in your working directory and pushing to `main` is authorized. `data/polls.json` is the table (see README.md for the schema). Any text that goes into the data is written in Portuguese. Note: the live site itself may be unreachable from this sandbox; you never need it.

1. Build the list of pending registrations yourself:
   a. Download https://raw.githubusercontent.com/rafaujo/eleicoes-2026-pesquisas/main/data/tse-metadata.json (a community mirror of the TSE open-data registry of 2026 presidential poll registrations; fields: protocol, tradeName/company, fieldStart, fieldEnd, disclosureDate, sample, registeredAt, statistician). Normalise protocols to the form `BR-NNNNN/YYYY` (e.g. BR084282026 -> BR-08428/2026).
   b. Read `data/polls.json`. A registration is pending when its protocol appears neither in any `registration` of `polls` nor in `ignored`, and its disclosureDate is today or earlier (America/Sao_Paulo).
   c. If there are no pending registrations, stop and say so.
2. For each pending registration (newest disclosureDate first, at most 8 per run):
   a. Search for the publication with WebSearch: institute name + "pesquisa" + "Lula" + "Flávio Bolsonaro" + "segundo turno" + month, on the institute's own site and on UOL, Folha, Estadão/Broadcast, CNN Brasil, Exame, Veja, Poder360, G1, Metrópoles, Correio Braziliense. Prefer the institute's report or the contracting outlet's article. Read it with WebFetch.
   b. Confirm it is the same poll: same institute, field dates equal to fieldStart/fieldEnd (±1 day only if the article is explicit), sample size equal to `sample` (±5%), and the TSE registration number if printed. If any of these do not match, do not use it.
   c. Extract the second-round Lula × Flávio Bolsonaro numbers: percentage of total respondents (not "votos válidos"), the published margin of error (p.p.) and the article date.
   d. If the poll has no Lula × Flávio runoff scenario (first round only, other matchup, state-level, or withdrawn by the institute), append its protocol to `ignored` in `data/polls.json` and add one short sentence to `notes` saying why.
   e. If you found and verified the numbers, append one object to `polls`: pollster (use the spelling already used in the file for that institute, e.g. "AtlasIntel/Bloomberg", "BTG/Nexus", "Futura/100% Cidades", "Quaest", "Datafolha"), start, end, published (article date, YYYY-MM-DD), lula, flavio (numbers, at most one decimal), sample, moe, registration (normalised protocol), source (article URL). Keep `polls` sorted by `published` ascending. Add a sentence to `notes` only when the publication has a divergence worth recording, in the style of the existing notes.
   f. If you cannot find or verify the numbers, leave the registration pending. Never guess. Never use aggregators (Poder360 agregador, Wikipedia) as the source.
3. Whenever you changed anything, set `updated` to today's date (America/Sao_Paulo) and validate the file with `python3 -m json.tool data/polls.json > /dev/null`.
4. If anything changed: `git add data/polls.json`, commit with message `polls: <institute(s)> <YYYY-MM-DD>` and `git push origin main`. The server picks the file up within 10 minutes.
5. Finish with a three-line summary: rows added (institute, numbers, source URL); protocols ignored (and why); protocols still pending (and why).

Never edit index.html or anything under cron/. Never remove or alter existing rows unless the same publication corrects its own numbers (then record it in `notes`).
