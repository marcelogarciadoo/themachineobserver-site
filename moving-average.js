// Descriptive only: no imputation, weighting by sample size, or projection.
export const DAY=86400000;
// Display layer only: empty statistical windows remain empty in movingAverage().
// Never backfill before the first observation or count a held value as a poll.
export function carryForward(points){
  let last=null;
  return points.map(p=>{
    if(p.v!==null){last=p;return {...p,carried:false,asOf:p.t};}
    return {...p,v:last?.v??null,carried:!!last,asOf:last?.t??null};
  });
}
export function movingAverage(polls,key,{start,end,lead=false}={}){
  const observations=[...new Map(polls.map(p=>[p.waveId||`${p.pollster}|${p.registration||p.end}|${p.round}`,p])).values()]
    .map(p=>({t:Date.parse(p.published),v:lead?p.values.flavio-p.values.lula:p.values[key]}))
    .filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.v));
  if(!observations.length)return [];
  start??=Math.min(...observations.map(p=>p.t));end??=Math.max(...observations.map(p=>p.t));
  const points=[];
  for(let t=start;t<=end;t+=DAY){const window=observations.filter(p=>p.t>=t-6*DAY&&p.t<=t);points.push({t,n:window.length,v:window.length?window.reduce((sum,p)=>sum+p.v,0)/window.length:null});}
  return points;
}
