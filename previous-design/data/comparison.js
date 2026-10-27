// Synthetic display fixtures only: no PNAD adjustment or forecast is computed here.
export const runoffForecast = [
  {id:'lula',name:'Lula',color:'#501C72',mean:51.9,low:48.2,high:55.6},
  {id:'flavio',name:'Flávio Bolsonaro',color:'#328088',mean:48.1,low:44.4,high:51.8}
];

// Dated pre-projection benchmarks, on the same total-respondent basis as raw polls.
// These represent the OUTPUT of future PNAD + house-bias correction, not live results.
export const currentBenchmarks = [
  ['2026-09-17',49.0,45.0],['2026-09-14',48.8,45.2],
  ['2026-09-11',48.8,45.4],['2026-09-08',49.1,45.1],
  ['2026-09-05',49.2,45.0],['2026-09-02',49.5,44.9]
].map(([date,lula,flavio])=>({date,lula,flavio,round:2,basis:'total respondents',stage:'PNAD + house-bias corrected; before projection',version:'MOCK-current-v1'}));

export const flavioMinusLula = (flavio,lula) => +(flavio-lula).toFixed(1);

export function latestPolls(records,round=2){
  const latest=new Map();
  for(const poll of records.filter(p=>p.round===round)){
    const previous=latest.get(poll.institute);
    if(!previous||poll.date>previous.date||(poll.date===previous.date&&poll.id>previous.id))latest.set(poll.institute,poll);
  }
  return [...latest.values()];
}

export function currentComparisons(records,candidate,benchmarks=currentBenchmarks){
  return latestPolls(records).map(poll=>{
    const benchmark=benchmarks.find(b=>b.date===poll.date&&b.round===poll.round&&b.basis==='total respondents');
    const raw=poll[candidate],corrected=benchmark?.[candidate];
    const difference=Number.isFinite(raw)&&Number.isFinite(corrected)?+(raw-corrected).toFixed(1):null;
    const distance=difference!==null&&Number.isFinite(poll.moe)&&poll.moe>0?Math.abs(difference)/poll.moe:null;
    return {poll,benchmark,raw,corrected,difference,distance,excess:distance===null?null:+Math.max(0,Math.abs(difference)-poll.moe).toFixed(1)};
  }).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||Math.abs(a.difference??Infinity)-Math.abs(b.difference??Infinity)||a.poll.institute.localeCompare(b.poll.institute));
}
