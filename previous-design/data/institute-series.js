import {firstSeries,secondSeries,institutes} from './mock.js';

// Explicitly synthetic institute-specific series for testing the filter UI.
// They are not raw poll results or estimated house effects.
export function instituteSeries(round,institute='all'){
  const base=round===2?secondSeries:firstSeries;
  if(institute==='all')return base;
  const position=institutes.findIndex(d=>d.id===institute);
  if(position<0)return [];
  const offset=[1.2,-.9,.6,-.5,.3,-.2][position];
  return base.map((s,ci)=>({...s,points:s.points.map((p,i)=>({t:p.t,p:+(p.p+(ci===0?1:ci===1?-1:0)*(offset+Math.sin(i/4+position)*.15)).toFixed(1)}))}));
}
