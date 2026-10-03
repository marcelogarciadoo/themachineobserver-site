// Runs in <head> before styles paint, including on localized routes.
// Storage is optional: blocked storage must never prevent a page from loading.
(()=>{
  const key='observer-theme',root=document.documentElement;
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  const valid=value=>value==='light'||value==='dark';
  let preference=null;
  try{const saved=localStorage.getItem(key);if(valid(saved))preference=saved;}catch{}
  function apply(){
    const theme=preference||(system.matches?'dark':'light');
    root.dataset.theme=theme;
    document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.themeChoice===theme));
    const button=document.querySelector('[data-theme-toggle]');if(!button)return;
    const dark=theme==='dark',pt=root.lang.startsWith('pt');
    const name=pt?(dark?'Claro':'Escuro'):(dark?'Light':'Dark');
    const action=pt?`Ativar modo ${name.toLowerCase()}`:`Switch to ${name.toLowerCase()} mode`;
    button.setAttribute('aria-label',action);button.title=action;
    button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${dark?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>':'<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5 8.6 8.6 0 1 0 20.5 14.2Z"/>'}</svg><span>${name}</span>`;
  }
  apply();
  document.addEventListener('observer:theme-control',apply);
  document.addEventListener('click',event=>{
    const choice=event.target.closest?.('[data-theme-choice]');
    if(!choice&&!event.target.closest?.('[data-theme-toggle]'))return;
    preference=choice?choice.dataset.themeChoice:(root.dataset.theme==='dark'?'light':'dark');
    try{localStorage.setItem(key,preference);}catch{}
    apply();
  });
  system.addEventListener('change',()=>{if(!preference)apply();});
  window.addEventListener('pageshow',()=>{
    try{const saved=localStorage.getItem(key);preference=valid(saved)?saved:null;}catch{}
    apply();
  });
  window.addEventListener('storage',event=>{
    if(event.key!==key&&event.key!==null)return;
    preference=valid(event.newValue)?event.newValue:null;apply();
  });
})();
