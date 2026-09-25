import {electionResults} from './data/election-results.js?v=20e456b2ab21';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const historicalResult=(year,round)=>electionResults.find(r=>r.year===Number(year)&&r.round===Number(round));
export function historicalResultsHTML(year,round,lang='en'){
  const r=historicalResult(year,round),pt=lang==='pt',L=(en,br)=>pt?br:en;
  if(!r)return `<p>${L('No election result in this selection.','Nenhum resultado eleitoral nesta seleção.')}</p>`;
  const number=n=>new Intl.NumberFormat(pt?'pt-BR':'en-GB').format(n);
  const percent=n=>new Intl.NumberFormat(pt?'pt-BR':'en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+'%';
  const date=new Intl.DateTimeFormat(pt?'pt-BR':'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(r.election_date));
  const verified=r.approved_as_model_target,candidates=[...r.candidates].sort((a,b)=>b.votes-a.votes);
  const sourceName=r.source_id==='oas2018'?L('OAS observation report · p. 10','Relatório de observação da OEA · p. 10'):r.year===2018?L('TSE signed report · pp. 6–7','Relatório assinado do TSE · pp. 6–7'):L('TSE · official results','TSE · resultados oficiais');
  const status=verified?L('Official election result','Resultado oficial da eleição'):L('Historical record · verification pending','Registro histórico · verificação pendente');
  const warning=!verified?`<p class="historical-warning"><strong>${L('2018 first round: reconciliation pending.','Primeiro turno de 2018: conciliação pendente.')}</strong> ${L('Figures reproduced in the OAS report; direct verification against the final TSE dataset is still pending. Candidate votes plus blank and null votes differ from the reported turnout by 746. These figures are not used to calibrate the model.','Números reproduzidos no relatório da OEA; a conferência direta com a base final do TSE ainda está pendente. Votos dos candidatos, brancos e nulos diferem do comparecimento informado em 746. Estes números não são usados para calibrar o modelo.')}</p>`:'';
  const totals=[['valid_votes',L('Valid votes','Votos válidos')],['turnout',L('Turnout','Comparecimento')],['blank_votes',L('Blank votes','Votos brancos')],['null_votes',L('Null votes','Votos nulos')],['abstentions',L('Abstentions','Abstenções')]].filter(([key])=>Number.isFinite(r[key]));
  return `<section class="historical-results" aria-labelledby="historical-title-${r.year}-${r.round}"><h2 id="historical-title-${r.year}-${r.round}">${r.year} · ${r.round===1?L('First round','Primeiro turno'):L('Second round','Segundo turno')}</h2><p class="table-status">${status} · <time datetime="${r.election_date}">${date}</time></p>${warning}${r.round===2?`<p class="historical-winner"><strong>${L('Elected president','Presidente eleito')}: ${escape(candidates[0].name)}</strong> · ${percent(candidates[0].valid_pct_reported)} ${L('of valid votes','dos votos válidos')}</p>`:''}<div class="table-scroll" tabindex="0" role="region" aria-label="${L('Candidate election results','Resultados eleitorais por candidato')}"><table class="historical-table"><caption class="table-caption">${L('Presidential election · Brazil, including overseas votes · descending vote count','Eleição presidencial · Brasil, incluindo votos no exterior · ordem decrescente de votos')}</caption><thead><tr><th scope="col">${L('Candidate','Candidato')}</th><th scope="col" class="num">${L('Votes','Votos')}</th><th scope="col" class="num">${L('Valid votes (%)','Votos válidos (%)')}</th></tr></thead><tbody>${candidates.map(c=>`<tr><th scope="row">${escape(c.name)}</th><td class="num">${number(c.votes)}</td><td class="num">${percent(c.valid_pct_reported)}</td></tr>`).join('')}</tbody></table></div><p class="raw-source">${L('Percentages as published, not recalculated. These are counted votes, not polls or forecasts; no polling margin of error applies.','Percentuais como publicados, sem recálculo. São votos apurados, não pesquisas nem previsões; não se aplica margem de erro amostral.')}</p><dl class="historical-totals">${totals.map(([key,label])=>`<div><dt>${label}</dt><dd>${number(r[key])}</dd></div>`).join('')}</dl><p class="raw-source"><a href="${escape(r.source_url)}" target="_blank" rel="noopener noreferrer">${sourceName}</a> · <a href="data/election-results.json">${L('Data & source hashes','Dados e hashes das fontes')}</a></p></section>`;
}

export function historicalResultsCSV(year,round){
  const r=historicalResult(year,round);
  if(!r)return '';
  const headers=['election_year','round','election_date','candidate','votes','valid_pct_reported','verification_status','approved_as_model_target','quality_flags','source_url','source_sha256'];
  const rows=[headers,...[...r.candidates].sort((a,b)=>b.votes-a.votes).map(c=>[r.year,r.round,r.election_date,c.name,c.votes,c.valid_pct_reported,r.status,r.approved_as_model_target,(r.quality_flags||[]).join(';'),r.source_url,r.source_sha256])];
  return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
}

export function downloadHistoricalResults(year,round){
  const url=URL.createObjectURL(new Blob([historicalResultsCSV(year,round)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`observer-election-results-${year}-round-${round}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function staticHistoricalResults(lang){
  return `<section class="raw-section"><h2>${lang==='pt'?'Resultados de eleições anteriores':'Past election results'}</h2>${[2022,2018].map(year=>[1,2].map(round=>`<details><summary>${year} · ${lang==='pt'?(round===1?'Primeiro turno':'Segundo turno'):(round===1?'First round':'Second round')}</summary>${historicalResultsHTML(year,round,lang)}</details>`).join('')).join('')}</section>`;
}
