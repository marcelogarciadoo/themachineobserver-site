import {rawHome,rawTrends,rawDatabase,hydrateRawRecords} from './raw-pages.js?v=20e456b2ab21';
import {methodologyHTML} from './methodology-flow.js?v=20e456b2ab21';
import {offendersHTML} from './offenders-page.js?v=20e456b2ab21';
import {adjustedPage} from './adjusted-page.js?v=20e456b2ab21';
import {connectMethodology} from './flow-layout.js?v=20e456b2ab21';
import { language,locale,translate,observeTranslations } from './i18n.js?v=20e456b2ab21';
import { mountPageRail,addLanguageSwitch } from './layout.js?v=20e456b2ab21';

const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=(t,year=false)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',...(year?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(t));
const stamp=t=>new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC';
const pct=n=>new Intl.NumberFormat(locale,{minimumFractionDigits:1,maximumFractionDigits:1}).format(n)+'%';
const marketPct=n=>new Intl.NumberFormat(locale,{minimumFractionDigits:1,maximumFractionDigits:2}).format(n)+'%';
const seriesInk=color=>`var(--series-${({'#501C72':'purple','#328088':'teal','#A06425':'ochre','#707888':'slate','#737C8E':'slate','#AD7DAC':'mauve'}[color]||'purple')},${color})`;
const labelInk=color=>`var(--label-${({'#501C72':'purple','#328088':'teal','#A06425':'ochre','#707888':'slate','#737C8E':'slate','#AD7DAC':'mauve'}[color]||'purple')},${color})`;
const signed=n=>(n>0?'+':'')+Number(n).toFixed(1);
const arrow='<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const wordmark='<span class="initial">T</span>HE <span class="initial">M</span>ACHINE <span class="initial">O</span>BSERVER';
const pages=[['index','Predict victory'],['first-round','First round'],['second-round','Second round'],['bet-markets','Bet markets'],['adjusted-results','Adjusted results'],['offenders','Offenders'],['methodology','Methodology'],['database','Database']];
const page=document.body.dataset.page;
const link=(href,label,primary=false)=>`<a class="${primary?'button primary':'text-link'}" href="${href}">${label}${arrow}</a>`;
const intro=(title,description,type='Illustrative data')=>`<section class="page-intro"><div><h1>${title}</h1><p>${description}</p></div><div class="page-meta"><span class="badge">${type}</span><br>Design edition · 19 September 2026</div></section>`;
const sourceFooter=(text,actions='')=>`<div class="chart-footer"><p>${text}</p><div class="actions">${actions}</div></div>`;
const downloadButton=(id,label='Download CSV')=>`<button class="link-button" id="${id}" type="button">${label}</button>`;
const chartShell=id=>`<div class="chart-wrap" id="${id}"></div>`;

$('#app').innerHTML=`<div class="prototype-strip">LOCAL PREVIEW · Published raw polls · Datafolha demographic research estimate · No residual effects or forecast</div><header class="container"><div class="masthead"><div class="edition"><strong>BRAZIL · 2026</strong><br>Presidential election observatory</div><a class="wordmark" aria-label="The Machine Observer home" href="index.html">${wordmark}</a><div class="edition right"><strong>Evidence before certainty.</strong><br>Independent views of the race</div></div><button class="menu-toggle" aria-expanded="false" aria-controls="navigation">${pages.find(x=>x[0]===page)?.[1]}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><nav id="navigation" class="main-nav" aria-label="Main navigation">${pages.map(([slug,title])=>`<a href="${slug}.html" ${page===slug?'aria-current="page"':''}>${title}</a>`).join('')}</nav></header><main class="container" id="main"></main><footer class="site-footer container"><div><a class="wordmark footer-wordmark" href="index.html">${wordmark}</a><p>Brazil’s presidential race, examined. Demographic research estimates are separated from residual institute effects and forecasts.</p></div><div class="footer-right"><a href="methodology.html">How to read the numbers</a><a href="database.html">Explore the evidence</a><a data-preserved-link href="https://themachineobserver.com/" target="_blank" rel="noopener noreferrer">${language==='pt'?'Site original (online)':'Original site (live)'}</a><a data-preserved-link href="previous-design/${language==='pt'?'pt/':''}index.html">${language==='pt'?'Design anterior · dados ilustrativos':'Previous design · illustrative data'}</a><p>Research edition · Published polling records · Archived market data<br>Not deployed · No production update routines connected</p></div></footer>`;
$('.prototype-strip').textContent=language==='pt'?'PRÉVIA LOCAL DE PESQUISA · Séries ajustadas experimentais e simulação condicional · Sem aprovação para publicação':'LOCAL RESEARCH PREVIEW · Experimental adjusted series and conditional simulation · Not approved for publication';
$('.footer-right p:last-child').innerHTML=language==='pt'?'Edição de pesquisa · Registros publicados · Mercados arquivados<br>Pipeline de homologação pronto · Não implantado':'Research edition · Published polling records · Archived market data<br>Staging pipeline ready · Not deployed';
$('.menu-toggle').addEventListener('click',e=>{const btn=e.currentTarget;const open=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',open);$('#navigation').classList.toggle('open',open)});
const header=$('header'),headerInner=document.createElement('div');
headerInner.className='container';headerInner.append(...header.childNodes);header.append(headerInner);header.className='site-header';
new ResizeObserver(()=>document.documentElement.style.setProperty('--header-height',`${header.offsetHeight}px`)).observe(header);

function csvDownload(filename,rows){
  const content=rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function seriesCSV(series){const times=[...new Set(series.flatMap(s=>s.points.map(p=>p.t)))].sort((a,b)=>a-b);const maps=series.map(s=>new Map(s.points.map(p=>[p.t,p.p])));return [['timestamp_utc',...series.map(s=>s.name)],...times.map(t=>[new Date(t).toISOString(),...maps.map(m=>m.get(t)??'')])];}

// Responsive, accessible native SVG chart. No smoothing or fabricated interpolation.
function drawChart(host,series,{min=0,max=60,step=10,band=false,threshold=null,title='Time series',unit='%',market=false,maxGap=Infinity,domain=null,square=false}={}){
  const width=Math.max(240,host.clientWidth||900),narrow=width<600,L=34,R=(narrow||square)?18:154,T=22,B=35,W=width-L-R,H=square?W+T+B:(narrow?310:350),PH=H-T-B;
  const observations=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.t));
  if(!observations.length){host.innerHTML='<div class="empty-state"><h3>No series selected</h3><p>Select a candidate above to show the chart.</p></div>';return;}
  let [start,end]=domain||[Math.min(...observations.map(p=>p.t)),Math.max(...observations.map(p=>p.t))];if(start===end)end=start+86400000;
  const x=t=>L+(t-start)/(end-start)*W, y=p=>T+(max-p)/(max-min)*PH;
  const grid=[];for(let v=min;v<=max+.01;v+=step)grid.push(`<line class="${v===0?'zero-line':'axis-line'}" x1="${L}" x2="${L+W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${v}${v===max&&unit==='%'?'%':''}</text>`);
  const xTicks=Array.from({length:narrow?4:6},(_,i)=>start+(end-start)*i/(narrow?3:5));
  const tickDate=t=>end-start>185*86400000?new Intl.DateTimeFormat(locale,{month:'short',year:narrow?'2-digit':'numeric',timeZone:'UTC'}).format(new Date(t)):date(t);
  const axis=xTicks.map(t=>`<text x="${x(t)}" y="${H-9}" text-anchor="${t===start?'start':t===end?'end':'middle'}">${end-start<2*86400000?new Date(t).toISOString().slice(11,16):tickDate(t)}</text>`).join('');
  const last=series.map(s=>({s,p:[...s.points].reverse().find(p=>Number.isFinite(p.p))})).filter(d=>d.p).sort((a,b)=>b.p.p-a.p.p);
  const labelYs=[];last.forEach((d,i)=>labelYs[i]=Math.max(y(d.p.p),i?labelYs[i-1]+23:T+4));
  if(labelYs.at(-1)>H-B) {const excess=labelYs.at(-1)-(H-B);for(let i=0;i<labelYs.length;i++)labelYs[i]-=excess;}
  const paths=series.map((s,si)=>{
    let prev=null;let path='';for(const p of s.points){if(!Number.isFinite(p.p)){prev=null;continue;}const gap=prev&&p.t-prev.t>maxGap;path+=(prev&&!gap?'L':'M')+x(p.t).toFixed(2)+','+y(p.p).toFixed(2);prev=p;}
    const finite=s.points.filter(p=>Number.isFinite(p.p));
    const region=band&&si<2&&finite.length?`<path d="M${finite.map(p=>`${x(p.t)},${y(Math.min(max,p.p+2.3))}`).join('L')}L${[...finite].reverse().map(p=>`${x(p.t)},${y(Math.max(min,p.p-2.3))}`).join('L')}Z" fill="${seriesInk(s.color)}" opacity=".075"/>`:'';
    const isolated=market?finite.filter(p=>{const j=s.points.indexOf(p),before=s.points[j-1],after=s.points[j+1];return (!before||!Number.isFinite(before.p)||p.t-before.t>maxGap)&&(!after||!Number.isFinite(after.p)||after.t-p.t>maxGap)}).map(p=>`<circle cx="${x(p.t)}" cy="${y(p.p)}" r="1.5" fill="${seriesInk(s.color)}"/>`).join(''):'';
    return `${region}<path class="series-line" d="${path}" stroke="${seriesInk(s.color)}" ${si>1?'stroke-dasharray="5 3"':''}/>${isolated}`;
  }).join('');
  const endLabels=(narrow||square)?'':last.map((d,i)=>`<path d="M${x(d.p.t)},${y(d.p.p)} L${L+W+12},${labelYs[i]} h8" fill="none" stroke="${seriesInk(d.s.color)}" stroke-width=".8"/><text class="end-label" x="${L+W+25}" y="${labelYs[i]+4}" style="fill:${labelInk(d.s.color)}">${esc(d.s.name==='Flávio Bolsonaro'?'F. Bolsonaro':d.s.name)} ${market?marketPct(d.p.p):d.p.p.toFixed(1)+(unit==='%'?'%':'')}</text>`).join('');
  host.innerHTML=`<svg class="chart-svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="${esc(title)}. Exact values available in the chart readout and data table."><g>${grid.join('')}${axis}</g>${threshold!==null?`<line x1="${L}" x2="${L+W}" y1="${y(threshold)}" y2="${y(threshold)}" stroke="var(--chart-reference)" stroke-dasharray="4 5"/><text x="${L+6}" y="${y(threshold)-7}">50% reference</text>`:''}${paths}${endLabels}<g class="chart-guide" hidden><line class="guide" x1="${L}" x2="${L}" y1="${T}" y2="${H-B}"/><g class="chart-tooltip-points"></g></g></svg><div class="chart-readout" aria-live="polite" aria-atomic="true"></div><p class="chart-hint">${market?'Observation times may differ by series. ':''}Move across the chart to inspect · focus the chart and use ← / →</p>`;
  const svg=$('svg',host);svg.setAttribute('tabindex','0');svg.setAttribute('aria-label',title+'. Use left and right arrow keys to inspect observations.');
  const times=[...new Set(observations.map(p=>p.t))].sort((a,b)=>a-b);let index=times.length-1;
  const readout=$('.chart-readout',host),guide=$('.chart-guide',host);
  function show(t,visible=true){
    guide.hidden=!visible;guide.removeAttribute('hidden');guide.style.display=visible?'':'none';
    $('.guide',host).setAttribute('x1',x(t));$('.guide',host).setAttribute('x2',x(t));let dots='';
    readout.innerHTML=`<strong>${market?'As of '+stamp(t):date(t,true)}</strong>`+series.map(s=>{
      const exact=market?[...s.points].reverse().find(p=>p.t<=t&&Number.isFinite(p.p)):s.points.find(p=>p.t===t&&Number.isFinite(p.p));
      if(exact)dots+=`<circle cx="${x(exact.t)}" cy="${y(exact.p)}" r="4" fill="${seriesInk(s.color)}"/>`;
      return `<span><i class="swatch" style="--series:${seriesInk(s.color)}"></i>${esc(s.name)} <strong>${exact?(market?marketPct(exact.p):exact.p.toFixed(1)+(unit==='%'?'%':' p.p.')):'—'}</strong>${market&&exact?` <span class="observation-time">(${stamp(exact.t)})</span>`:''}</span>`;
    }).join('');$('.chart-tooltip-points',host).innerHTML=dots;
  }
  show(times.at(-1),false);
  svg.addEventListener('pointermove',e=>{const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)*width/rect.width;const target=start+Math.max(0,Math.min(1,(px-L)/W))*(end-start);index=times.reduce((best,t,i)=>Math.abs(t-target)<Math.abs(times[best]-target)?i:best,0);show(times[index]);});
  svg.addEventListener('pointerleave',()=>show(times[index],false));
  svg.addEventListener('focus',()=>show(times[index]));
  svg.addEventListener('blur',()=>show(times[index],false));
  svg.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();index=e.key==='Home'?0:e.key==='End'?times.length-1:Math.max(0,Math.min(times.length-1,index+(e.key==='ArrowRight'?1:-1)));show(times[index]);}});
}
function addResize(render){let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(render,120)});}
function observationTable(series,limit=100){const rows=seriesCSV(series);return `<div class="table-scroll"><table><caption class="table-caption">${rows.length-1} observation timestamps. ${rows.length-1>limit?`Latest ${limit} shown; CSV includes the entire selection.`:''} Blank cells are unavailable, not zero.</caption><thead><tr>${rows[0].map(x=>`<th>${esc(x.replace('timestamp_utc','Timestamp (UTC)'))}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).reverse().slice(0,limit).map(row=>`<tr>${row.map((v,i)=>`<td>${i? (v===''?'—':marketPct(Number(v))):esc(v.replace('T',' ').slice(0,19))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}

async function markets(){
  const marketReading=language==='pt'?'São preços de contratos “Sim”, multiplicados por 100. Cada mercado tem regras de liquidação, liquidez e candidatos próprios. As séries apresentadas não precisam somar 100%.':'These are “Yes” contract prices, multiplied by 100. Each market has its own settlement rules, liquidity and candidate selection. The displayed series need not add up to 100%.';
  $('#main').innerHTML=intro('What the markets are pricing.','Two markets. Two independent views of the election. Contract prices are not vote shares, and neither is our forecast.','Synchronized market data')+`<div id="market-panels"><div class="loading" role="status">Loading market snapshots…</div></div><section class="insight-row"><div><h3>Read prices, not predictions of votes.</h3><p>${marketReading}</p></div><div><h3>Updates remain independent.</h3><p>Each market file loads separately with cache bypass. One unavailable provider cannot suppress the other chart. Missing observations remain missing, and long gaps break the line.</p></div></section>`;
  const results=await Promise.allSettled(['kalshi','polymarket'].map(async id=>{const res=await fetch(`data/${id}.json?release=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw Error('Snapshot unavailable');return res.json()}));
  $('#market-panels').innerHTML='';
  results.forEach((result,i)=>{
    const id=i?'polymarket':'kalshi',name=i?'Polymarket':'Kalshi',panel=document.createElement('section');panel.className='market-panel';panel.id=id;$('#market-panels').append(panel);
    if(result.status==='rejected'){panel.innerHTML=`<div class="error-state"><h2>${name} snapshot unavailable</h2><p>The other chart can still be used. Check the local data file and reload.</p><button onclick="location.reload()">Reload page</button></div>`;return;}
    const data=result.value,colorMap={'Lula':'#501C72','Luiz Inácio Lula da Silva':'#501C72','Flávio Bolsonaro':'#328088','Augusto Cury':'#A06425','Jair Bolsonaro':'#737C8E','Renan Santos':'#AD7DAC'};
    const allPoints=s=>{const points=i?[...(s.ranges?.ALL||[]),...(s.ranges?.['1M']||[])]:[...(s.points||[]),...(s.hourly||[])];return [...new Map(points.map(p=>[p.t,p])).values()].sort((a,b)=>a.t-b.t);};
    const months=[...new Set(data.series.flatMap(s=>allPoints(s)).map(p=>new Date(p.t).toISOString().slice(0,7)))].sort(),defaultMonth=months.includes('2026-01')?'2026-01':months[0];let startMonth=defaultMonth,view=[];
    const monthChoices=months.map(value=>`<option value="${value}" ${value===defaultMonth?'selected':''}>${new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T00:00:00Z'))}</option>`).join('');
    panel.innerHTML=`<div class="market-heading"><div><h2>${name}</h2><p>Presidential election winner · synchronized contract prices</p></div><label class="field">${language==='pt'?'Mês inicial':'Starting month'} <select class="market-start-month">${monthChoices}</select></label></div><div class="market-legend"></div>${chartShell(id+'-chart')}<p class="market-meta"></p>${sourceFooter('Source: '+name+' synchronized snapshot.',downloadButton(id+'-csv')+`<a class="text-link" href="${i?'https://polymarket.com/event/brazil-presidential-election':'https://kalshi.com/markets/kxbrpres/brazil-presidency'}" target="_blank" rel="noopener noreferrer">Open market ${arrow}</a>`)}<details><summary>Inspect prices and observation times</summary><div class="market-values"></div></details>`;
    function render(){const end=Number(data.cutoff),start=Date.parse(startMonth+'-01T00:00:00Z');
      view=data.series.map((s,k)=>({...s,name:s.name==='Luiz Inácio Lula da Silva'?'Lula':s.name,color:colorMap[s.name]||['#501C72','#328088','#A06425','#737C8E'][k],points:allPoints(s).filter(p=>p.t>=start&&p.t<=end)}));
      $('.market-legend',panel).innerHTML=view.map(s=>{const p=[...s.points].reverse().find(p=>Number.isFinite(p.p));return `<div><span class="name"><i class="swatch" style="--series:${seriesInk(s.color)}"></i>${esc(s.name)}</span><span class="value" style="color:${labelInk(s.color)}">${p?marketPct(p.p):'—'}</span><time>${p?stamp(p.t):'No observation in this period'}</time></div>`}).join('');
      drawChart($('#'+id+'-chart'),view,{min:0,max:100,step:20,market:true,square:true,maxGap:3*86400000,domain:[start,end],title:name+' contract prices'});
      const startLabel=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(start));
      $('.market-meta',panel).textContent=language==='pt'?`Data de corte: ${stamp(end)} · desde ${startLabel} · horários em UTC`:`Snapshot cutoff: ${stamp(end)} · starting ${startLabel} · UTC throughout`;
      $('.market-values',panel).innerHTML=observationTable(view,80);
    }
    $('.market-start-month',panel).addEventListener('change',event=>{startMonth=event.target.value;render()});
    $('#'+id+'-csv').addEventListener('click',()=>csvDownload(`${id}-${startMonth}.csv`,seriesCSV(view)));render();addResize(render);
  });
}

function methodology(){ $('#main').innerHTML=methodologyHTML(language); }

const rawPages=new Set(['index','first-round','second-round','database']);
if(rawPages.has(page))try{await hydrateRawRecords();}catch(error){console.warn(error);$('.prototype-strip').textContent+=' · '+(language==='pt'?'usando o último arquivo válido':'using last valid snapshot');}
try{if(page==='index')rawHome();else if(page==='first-round')rawTrends(1);else if(page==='second-round')rawTrends(2);else if(page==='bet-markets')markets();else if(page==='adjusted-results')adjustedPage();else if(page==='offenders')$('#main').innerHTML=offendersHTML(language);else if(page==='database')rawDatabase();else {
  methodology();
}}catch(error){console.error(error);$('#main').innerHTML='<section class="error-state"><h1>The page could not load.</h1><p>Please reload the local prototype. Its production counterpart is unaffected.</p><button onclick="location.reload()">Reload</button></section>';}
if(rawPages.has(page))setInterval(async()=>{try{const status=await hydrateRawRecords();if(status.changed)location.reload();}catch(error){console.warn(error);}},15*60*1000);
if(page==='bet-markets')setInterval(()=>location.reload(),15*60*1000);

mountPageRail(page);addLanguageSwitch(page);observeTranslations();
if(page==='methodology')connectMethodology();
// Charts first render before the shared rail exists. Re-measure the narrower content column.
window.dispatchEvent(new Event('resize'));

// Route content is inserted after document parsing; resolve incoming anchors after layout.
const initialAnchor=document.getElementById(location.hash.slice(1));
if(initialAnchor)requestAnimationFrame(()=>{
  document.documentElement.style.setProperty('--header-height',`${header.offsetHeight}px`);
  initialAnchor.scrollIntoView({block:'start',behavior:'instant'});
});
