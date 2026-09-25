import {pageContent} from './page-content.js';
import {language,translate,localizeDOM} from './i18n.js';

export function addLanguageSwitch(page){
  const flag=code=>code==='pt'?'<svg viewBox="0 0 28 20" aria-hidden="true"><path fill="#16843B" d="M0 0h28v20H0z"/><path fill="#FDD840" d="m14 2 12 8-12 8L2 10z"/><circle cx="14" cy="10" r="5" fill="#17448E"/><path d="M9.5 8.5q5-1 9 3" fill="none" stroke="#fff" stroke-width="1.2"/></svg>':`<svg viewBox="0 0 28 20" aria-hidden="true"><path fill="#fff" d="M0 0h28v20H0z"/>${Array.from({length:7},(_,i)=>`<path fill="#B3263C" d="M0 ${i*40/13}h28v${20/13}H0z"/>`).join('')}<path fill="#253B72" d="M0 0h12v10.8H0z"/>${Array.from({length:50},(_,i)=>{const row=Math.floor(i/11)*2+(i%11>=6?1:0),col=i%11>=6?i%11-6:i%11;return `<circle fill="#fff" cx="${1+col*2+(row%2)}" cy="${1+row*1.1}" r=".38"/>`}).join('')}</svg>`;
  const bar=document.createElement('nav');bar.className='language-switch';bar.setAttribute('aria-label',translate('Language'));
  bar.innerHTML=['en','pt'].map(code=>`<a data-language="${code}" href="${code==='pt'?'pt/':''}${page}.html${location.search}${location.hash}" lang="${code==='pt'?'pt-BR':'en'}" hreflang="${code==='pt'?'pt-BR':'en'}" ${language===code?'aria-current="true"':''} aria-label="${code==='pt'?'Português do Brasil':'English'}">${flag(code)}<span>${code.toUpperCase()}</span></a>`).join('');
  const tools=document.createElement('div');tools.className='header-tools';
  const themeButton=document.createElement('button');themeButton.type='button';themeButton.className='theme-toggle';themeButton.dataset.themeToggle='';
  tools.append(themeButton,bar);document.querySelector('.site-header>.container').prepend(tools);
  document.dispatchEvent(new Event('observer:theme-control'));
  const sync=()=>bar.querySelectorAll('a').forEach(a=>a.setAttribute('href',`${a.dataset.language==='pt'?'pt/':''}${page}.html${location.search}${location.hash}`));
  window.addEventListener('hashchange',sync);document.addEventListener('change',()=>queueMicrotask(sync));document.addEventListener('click',()=>queueMicrotask(sync));
}

export function mountPageRail(page){
  const main=document.querySelector('#main');
  const sections=[];
  const mark=(selector,id,label)=>{const node=main.querySelector(selector);if(node){node.id=id;sections.push([id,label]);}};
  if(page==='methodology'){
    main.querySelectorAll('.method-article>section').forEach(s=>sections.push([s.id,s.querySelector('h2').textContent]));
    main.querySelector('.method-toc')?.remove();
    const old=main.querySelector('.method-layout');if(old)old.replaceWith(...old.childNodes);
  }else if(page==='index'){
    main.querySelector('.forecast-art')?.remove();
    mark('.forecast-stage','prediction','Expected result');mark('.forecast-values','result-values','Vote shares & intervals');mark('.below-figure','reading-result','Reading the forecast');
  }else if(page==='first-round'||page==='second-round'){
    mark('.toolbar','trend-filters','Period & institute');mark('#poll-chart','poll-chart','Leading candidates');
    mark(page==='first-round'?'#other-chart':'#lead-chart',page==='first-round'?'other-chart':'lead-chart',page==='first-round'?'Other candidates':'Flávio minus Lula');
    mark('details','trend-values','Chart values');mark('.insight-row','trend-notes','How to read the trends');
  }else if(page==='bet-markets'){
    sections.push(['kalshi','Kalshi'],['polymarket','Polymarket']);mark('.insight-row','market-notes','Reading market prices');
  }else if(page==='offenders'){
    mark('.offenders-layout','historical-ranking','Historical errors');mark('#scorecard','scorecard','Institute scorecard');mark('.distance-section','current-distance','Current poll distance');
  }else{
    mark('.database-tabs','poll-rounds','Choose a round');mark('.database-toolbar','database-filters','Search & institute');mark('#poll-table','poll-table','Individual polls');mark('.insight-row','database-notes','About the records');
  }
  const layout=document.createElement('div');layout.className='page-layout';
  const rail=document.createElement('aside');rail.className='page-rail';
  rail.innerHTML=`<img class="rail-art" src="assets/${pageContent[page].art}" width="240" height="240" alt="" decoding="async"><nav class="rail-nav" aria-label="${translate('On this page')}">${sections.map(([id,label])=>`<a href="${language==='pt'?'pt/':''}${page}.html#${id}">${translate(label)}</a>`).join('')}</nav>`;
  // Empty alt: paintings are decorative. Prompt/provenance live in project files, not captions.
  const content=document.createElement('div');content.className='page-content';content.append(...main.childNodes);layout.append(rail,content);main.append(layout);
  rail.querySelectorAll('a').forEach(a=>a.addEventListener('click',event=>{
    const target=document.getElementById(new URL(a.href).hash.slice(1));if(!target)return;
    event.preventDefault();if(target.tagName==='DETAILS')target.open=true;
    history.replaceState(null,'',location.pathname+location.search+new URL(a.href).hash);
    target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    rail.querySelectorAll('a').forEach(link=>link.removeAttribute('aria-current'));a.setAttribute('aria-current','location');
  }));
  localizeDOM(main);
}
