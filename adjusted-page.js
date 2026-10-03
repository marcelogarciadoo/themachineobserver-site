import {language,locale} from './i18n.js?v=12be40692b19';
import {adjustedRelease} from './data/adjusted-release.js?v=12be40692b19';
import {movingAverage,carryForward,DAY} from './moving-average.js?v=12be40692b19';
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n);
const D=t=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(t));

export function adjustedHTML(lang='en',release=adjustedRelease){
  const pt=lang==='pt',L=(en,ptText)=>pt?ptText:en,ready=release.status==='ready',available=ready||release.status==='research';
  const totalWaves=release.adjusted?.length||0,unmatchedWaves=release.unmatched?.length||0;
  const pending=L('Awaiting a model release.','Aguardando uma versão do modelo.');
  const status=ready?L('Approved model output','Saída de modelo aprovada'):available?L('Matched-horizon research output','Resultado de pesquisa por horizonte pareado'):L('Results awaiting validation','Resultados aguardando validação');
  const explanation=available?L(
    `${totalWaves} runoff waves have an eligible same-institute 2022 comparison. Each match uses one historical wave containing both rounds, requires both election horizons to be within ±14 days, and applies the signed candidate error on valid votes. No PNAD or residual layer is used.`,
    `${totalWaves} rodadas de segundo turno têm uma comparação elegível do mesmo instituto em 2022. Cada pareamento usa uma única pesquisa histórica com os dois turnos, exige ambos os horizontes eleitorais dentro de ±14 dias e aplica o erro assinado de cada candidato sobre votos válidos. Não há camada PNAD nem resíduo.`
  ):pending;
  const months=available?[...new Set(release.adjusted.map(p=>p.published.slice(0,7)))].sort():[];
  const monthOptions=months.map(value=>`<option value="${value}">${E(new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T00:00:00Z')))}</option>`).join('');
  const toolbar=available?`<div class="toolbar"><label class="field">${L('Institute','Instituto')} <select id="adjusted-institute"><option value="all">${L('All institutes','Todos os institutos')}</option>${[...new Set(release.adjusted.map(p=>p.pollster))].sort().map(i=>`<option value="${E(i)}">${E(i)}</option>`).join('')}</select></label><label class="field">${L('Starting month','Mês inicial')} <select id="adjusted-start-month">${monthOptions}</select></label><p>${L('Matched-horizon series · descriptive 7-day averages','Série por horizonte pareado · médias descritivas de 7 dias')}</p></div>`:'';
  const placeholder=available?'':`<div class="adjusted-placeholder"><p>${pending}</p></div>`;
  return `<section class="page-intro"><div><h1>${L('Adjusted results.','Resultados ajustados.')}</h1><p>${L('Current valid-vote estimates after a transparent, same-institute historical correction.','Estimativas atuais de votos válidos após uma correção histórica transparente do mesmo instituto.')}</p></div></section><section id="adjustment-status" class="adjustment-status"><h2>${status}</h2><p>${explanation} <a href="${pt?'pt/':''}methodology.html#model-step-6">${L('Read the full methodology.','Leia a metodologia completa.')}</a></p></section>${toolbar}<div class="trend-grid"><section class="chart-panel" id="adjusted-shares"><h2>${L('Adjusted support · Lula & Flávio','Apoio ajustado · Lula e Flávio')}</h2><div class="legend-static">${L('Valid votes · %','Votos válidos · %')}</div><div id="adjusted-share-chart">${placeholder}</div></section><section class="chart-panel" id="adjusted-lead"><h2>Flávio − Lula</h2><div class="legend-static">${L('Adjusted difference · percentage points','Diferença ajustada · pontos percentuais')}</div><div id="adjusted-lead-chart">${placeholder}</div><p class="chart-hint">${L('Light teal above zero: Flávio ahead. Below zero: Lula ahead.','Fundo verde-claro acima de zero: Flávio à frente. Abaixo de zero: Lula à frente.')}</p></section></div><section class="adjustment-audit" id="adjustment-audit"><h2>${L('Inputs and audit trail','Insumos e trilha de auditoria')}</h2><ul><li>${L(`${totalWaves} matched waves; ${unmatchedWaves} waves remain unadjusted because no eligible historical match exists.`,`${totalWaves} rodadas pareadas; ${unmatchedWaves} permanecem sem ajuste por não terem comparação histórica elegível.`)}</li><li>${L('Formula by candidate: current valid-vote share + (2022 official result − matched 2022 poll).','Fórmula por candidato: percentual atual de votos válidos + (resultado oficial de 2022 − pesquisa pareada de 2022).')}</li><li>${L('The first- and second-round historical values must come from the same poll wave.','Os valores históricos de primeiro e segundo turnos devem vir da mesma rodada de pesquisa.')}</li><li>${L('PNAD, demographic reconstruction and residual standardization are excluded.','PNAD, reconstrução demográfica e padronização residual estão excluídas.')}</li></ul><p>${L('The paired raw/corrected Monte Carlo comparison is shown on Predict victory. Prediction markets remain separate.','A comparação Monte Carlo pareada, bruta e corrigida, está em Previsão de vitória. Mercados de previsão permanecem separados.')}</p><p><a href="data/adjusted-release.json">${L('Research release and hashes','Versão de pesquisa e hashes')}</a></p></section>`;
}

function chart(host,list,lead){
  if(!list.length){host.innerHTML='<p>—</p>';return;}
  const size=Math.max(300,host.clientWidth),left=40,right=16,top=24,width=size-left-right,low=lead?-20:0,high=lead?20:60;
  let start=Math.min(...list.map(p=>Date.parse(p.published))),end=Math.max(...list.map(p=>Date.parse(p.published)));if(start===end)end+=DAY;
  const x=t=>left+(t-start)/(end-start)*width,y=v=>top+(high-v)/(high-low)*width;
  let marks=lead?`<rect x="${left}" y="${top}" width="${width}" height="${y(0)-top}" fill="var(--positive-lead-bg)"/>`:'';
  for(let v=low;v<=high;v+=10)marks+=`<line class="${v===0?'zero-line':'axis-line'}" x1="${left}" x2="${left+width}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
  for(const [index,id] of (lead?['lead']:['lula','flavio']).entries()){
    const ink=index===1?'var(--series-teal)':'var(--series-purple)',points=carryForward(movingAverage(list,id,{start,end,lead}));let solid='',dotted='',prior=null,holding=false;
    for(const p of points){if(p.v===null)continue;if(prior){if(p.carried||prior.carried){if(!holding)dotted+=`M${x(prior.t)},${y(prior.v)}`;dotted+=`H${x(p.t)}`;if(!p.carried)dotted+=`V${y(p.v)}`;holding=p.carried;}else solid+=`M${x(prior.t)},${y(prior.v)}L${x(p.t)},${y(p.v)}`;}prior=p;}
    marks+=`<path d="${solid}" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="${dotted}" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="2 5"/>`;
    for(const p of list){const value=lead?p.values.flavio-p.values.lula:p.values[id];marks+=`<circle cx="${x(Date.parse(p.published))}" cy="${y(value)}" r="3" fill="${ink}"><title>${E(p.pollster)} · ${p.published} · ${id==='lead'?'Flávio − Lula':id==='lula'?'Lula':'Flávio'}: ${N(value)}</title></circle>`;}
  }
  marks+=`<text x="${left}" y="${top+width+26}">${D(start)}</text><text x="${left+width}" y="${top+width+26}" text-anchor="end">${D(end)}</text>`;
  host.innerHTML=`<svg class="chart-svg raw-svg" viewBox="0 0 ${size} ${top+width+38}" role="img" aria-label="${lead?'Flávio − Lula':'Lula / Flávio'}">${marks}</svg>`;
}

export function adjustedPage(){
  document.querySelector('#main').innerHTML=adjustedHTML(language);
  if(!['ready','research'].includes(adjustedRelease.status))return;
  const month=document.querySelector('#adjusted-start-month');month.value=month.options[0].value;
  const render=()=>{const institute=document.querySelector('#adjusted-institute').value,cutoff=month.value+'-01',list=adjustedRelease.adjusted.filter(p=>(institute==='all'||p.pollster===institute)&&p.published>=cutoff);chart(document.querySelector('#adjusted-share-chart'),list,false);chart(document.querySelector('#adjusted-lead-chart'),list,true);};
  document.querySelector('#adjusted-institute').onchange=render;month.onchange=render;window.addEventListener('resize',render);render();
}
