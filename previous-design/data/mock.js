// Design fixtures only. No values in this file are estimates of real outcomes.
export const candidates = [
  {id:'lula',name:'Lula',full:'Lula',color:'#501C72',share:44.8},
  {id:'flavio',name:'Flávio Bolsonaro',full:'Flávio Bolsonaro',color:'#328088',share:40.6},
  {id:'c',name:'Candidate C',full:'Candidate C (demo)',color:'#A06425',share:6.2},
  {id:'d',name:'Candidate D',full:'Candidate D (demo)',color:'#707888',share:3.1},
  {id:'others',name:'Others',full:'Other candidates (demo)',color:'#AD7DAC',share:5.3}
];
const anchors=[[42.1,41.2,42.8,43.1,42.6,44.1,44.8],[37.5,38.4,38.2,39.6,39.9,40.2,40.6],[8.2,8.6,7.8,7.1,6.8,6.6,6.2],[5.2,4.7,4.5,4.1,3.8,3.6,3.1]];
export const dates=Array.from({length:25},(_,i)=>Date.UTC(2026,3,4)+i*7*86400000);
export const firstSeries = candidates.map((c,ci)=>({...c,points:dates.map((t,i)=>{
  const values=anchors.map((a,k)=>{const n=Math.min(5,Math.floor(i/4));return a[n]+(a[n+1]-a[n])*(i-n*4)/4+(i%4===0?0:Math.sin(i*1.7+k)*.25)});
  return {t,p:+(ci<4?values[ci]:100-values.reduce((a,b)=>a+b,0)).toFixed(1)};
})}));
export const secondSeries=candidates.slice(0,2).map((c,ci)=>({...c,points:dates.map((t,i)=>({t,p:+(ci===0?50.5+i*.0625+Math.sin(i/2.5)*.6:49.5-i*.0625-Math.sin(i/2.5)*.6).toFixed(1)}))}));
export const institutes = ['A','B','C','D','E','F'].map((letter,i)=>({id:letter,name:`Institute ${letter}`,error:[6.8,5.1,3.9,2.8,2,1.4][i],deviation:[3.4,-2.6,1.8,-1.2,.8,-.4][i],grade:['D','C','C+','B','B+','A'][i],coverage:[12,18,21,16,24,28][i],bias:[4.1,-2.8,2.2,-1.5,.8,-.3][i],calibration:[58,65,71,79,85,91][i]}));
export const polls=Array.from({length:36},(_,i)=>{
  const round=i<18?1:2, n=i%18, institute=institutes[n%6].name;
  const date=new Date(Date.UTC(2026,8,17)-n*3*86400000).toISOString().slice(0,10);
  const fieldStart=new Date(Date.parse(date)-3*86400000).toISOString().slice(0,10);
  const fieldEnd=new Date(Date.parse(date)-86400000).toISOString().slice(0,10);
  return {id:`DEMO-${String(i+1).padStart(3,'0')}`,round,institute,date,fieldStart,fieldEnd,sample:1200+(n%5)*400,method:['In person','Telephone','Online panel'][n%3],lula:+((round===1?44.8:48.7)+Math.sin(n)*2).toFixed(1),flavio:+((round===1?40.6:46.2)+Math.cos(n)*1.7).toFixed(1),moe:2+(n%3)*.3,status:'Illustrative record'};
});
