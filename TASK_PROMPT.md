# Prompt for the scheduled Claude task "Atualizar pesquisas — themachineobserver.com"

You maintain the poll table of https://themachineobserver.com. The repository marcelogarciadoo/themachineobserver-site is checked out in your working directory; `data/polls.json` is the table (see README.md for the schema). Work in Portuguese for any text that goes into the data.

1. Fetch https://themachineobserver.com/data/pending.json (use WebFetch or curl). Each entry is a national presidential poll registered at the TSE whose planned release date has passed and whose results are not yet in `data/polls.json`. If the file is empty or missing, stop.
2. For each pending entry (newest first, at most 8 per run):
   a. Search for the publication: institute name + "pesquisa" + "Lula" + "Flávio Bolsonaro" + "segundo turno" + month, on the institute's own site and on UOL, Folha, Estadão/Broadcast, CNN Brasil, Exame, Veja, Poder360, G1, Metrópoles, Correio Braziliense. Prefer the institute's report or the contracting outlet's article.
   b. Read the article. Confirm it is the same poll: same institute, field dates equal to `start`/`end` (±1 day tolerance only if the article is explicit), sample size equal to `sample` (±5%), and the TSE registration number if printed. If any of these do not match, do not use it.
   c. Extract the second-round Lula × Flávio Bolsonaro numbers: percentage of total respondents (not "votos válidos"). Also the published margin of error (p.p.) and the release date of the article.
   d. If the poll has no Lula × Flávio runoff scenario (first round only, other candidate, state-level, or the institute withdrew it), append its registration to `ignored` in `data/polls.json` and mention why in `notes` in one short sentence.
   e. If you found and verified the numbers, append one row to `polls` with: pollster (use the site's existing spelling for that institute, e.g. "AtlasIntel/Bloomberg", "BTG/Nexus", "Futura/100% Cidades"), start, end, published (article date, YYYY-MM-DD), lula, flavio (numbers, one decimal max), sample, moe, registration, source (article URL). Keep the array sorted by `published` ascending. Add one sentence to `notes` only when the publication has a divergence worth recording (as the existing notes do).
   f. If you cannot find or verify the numbers, leave it pending. Do not guess and do not use aggregator sites (Poder360 agregador, Wikipedia) as the source.
3. Set `updated` to today's date (America/Sao_Paulo) whenever you changed anything. Validate that `data/polls.json` is valid JSON (`python3 -m json.tool data/polls.json`).
4. If anything changed: `git add data/polls.json`, commit with message "polls: <institute(s)> <date>" and push to `main`. The server picks the file up within 10 minutes.
5. Reply with a three-line summary: rows added (institute, numbers, source), registrations ignored, registrations still pending and why.

Never edit index.html or the cron scripts in this task. Never remove or alter existing rows unless the same publication corrects its own numbers (then note it in `notes`).
