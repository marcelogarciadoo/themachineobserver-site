// Pure numerical primitives. No fabricated demographic targets or historical errors.
// All shares are percentage points of TOTAL RESPONDENTS until simulateRunoff().
const keys=['lula','flavio','other'];
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const requireThat=(ok,message)=>{if(!ok)throw new Error(message);};
const share=x=>finite(x)&&x>=0&&x<=100;
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x));
const close=(a,b,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;
const sourceOK=x=>x&&typeof x.url==='string'&&(/https:\/\//.test(x.url)||/^urn:observer-artifact:[a-z0-9-]+$/.test(x.url))&&/^[a-f0-9]{64}$/.test(x.sha256||'');
export const ENGINE_VERSION='adjustment-core-0.2.0';

export function poststratify(poll,evidence){
  requireThat(evidence?.kind==='joint-cells','Joint cells are required; separate marginal corrections cannot be added.');
  requireThat(evidence.pollId===poll.id&&evidence.basis===poll.basis,'Wave and denominator must match.');
  requireThat(sourceOK(evidence.pollSource)&&sourceOK(evidence.benchmarkSource),'Source URLs and SHA-256 hashes are required.');
  requireThat(evidence.universeMatched===true&&evidence.categoriesMatched===true,'Population and category reconciliation is required.');
  requireThat(iso(evidence.availableAt)&&evidence.availableAt<=poll.published,'Benchmark unavailable at this historical cutoff.');
  const cells=evidence.cells;
  requireThat(Array.isArray(cells)&&cells.length>=2,'Missing joint cells.');
  requireThat(new Set(cells.map(c=>c.id)).size===cells.length&&cells.every(c=>typeof c.id==='string'&&c.id.length),'Cell IDs must be unique.');
  requireThat(cells.every(c=>finite(c.originalWeight)&&c.originalWeight>0&&finite(c.targetWeight)&&c.targetWeight>=0&&keys.every(k=>share(c.values?.[k]))&&close(sum(keys.map(k=>c.values[k])),100,.2)),'Invalid weights, empty source cells or incomplete response categories.');
  requireThat(close(sum(cells.map(c=>c.originalWeight)),1)&&close(sum(cells.map(c=>c.targetWeight)),1),'Weights must sum to one.');
  requireThat(finite(evidence.maxWeightRatio)&&evidence.maxWeightRatio>=1,'An explicit weight-ratio cap is required.');
  requireThat(cells.every(c=>c.targetWeight/c.originalWeight<=evidence.maxWeightRatio),'Calibration exceeds the weight-ratio cap.');
  const raw={...poll.values,other:100-poll.values.lula-poll.values.flavio};
  const reconstructed=Object.fromEntries(keys.map(k=>[k,sum(cells.map(c=>c.originalWeight*c.values[k]))]));
  requireThat(keys.every(k=>close(reconstructed[k],raw[k],.5)),'Cross-tabs do not reconstruct the published total within 0.5 points.');
  const values=Object.fromEntries(keys.map(k=>[k,sum(cells.map(c=>c.targetWeight*c.values[k]))]));
  return {values,delta:Object.fromEntries(keys.map(k=>[k,values[k]-raw[k]])),reconstructed,source:evidence.benchmarkSource};
}

export function correctPoll(poll,input,{releaseCutoff=poll.published}={}){
  requireThat(poll.round===2&&poll.basis==='total respondents'&&keys.slice(0,2).every(k=>share(poll.values[k])),'A compatible raw runoff poll is required.');
  requireThat(input?.pollId===poll.id,'Correction belongs to another wave.');
  let values={...poll.values,other:100-poll.values.lula-poll.values.flavio},demographic=null;
  if(input.demographic){demographic=poststratify(poll,input.demographic);values=demographic.values;}
  else if(input.demographicEstimate){
    const estimate=input.demographicEstimate;
    requireThat(sourceOK(estimate.artifact)&&estimate.supported===true,'A frozen demographic estimate and artifact are required.');
    requireThat(keys.every(k=>share(estimate.values?.[k]))&&close(sum(keys.map(k=>estimate.values[k])),100,.2),'Invalid upstream demographic estimate.');
    const raw={...poll.values,other:100-poll.values.lula-poll.values.flavio};
    const delta=Object.fromEntries(keys.map(k=>[k,estimate.values[k]-raw[k]]));
    requireThat(keys.every(k=>close(delta[k],estimate.delta[k],1e-6)),'Demographic delta does not reconcile to the frozen estimate.');
    demographic={values:estimate.values,delta,source:estimate.artifact,status:estimate.status};values=estimate.values;
  }
  else requireThat(typeof input.demographicExclusion==='string'&&input.demographicExclusion.length>0,'Explain why no demographic adjustment is applied.');
  const house=input.houseEffect;
  if(house){
    requireThat(sourceOK(house.artifact)&&iso(house.trainingCutoff)&&house.trainingCutoff<=releaseCutoff,'House-effect provenance or release cutoff is invalid.');
    requireThat(house.applicationMode==='retrospective_series_standardization','House effects must be labelled as retrospective standardization.');
    requireThat(house.pollster===poll.pollster&&house.residualAfterDemographics===!!demographic,'House effect must match institute and prior demographic treatment.');
    requireThat(keys.every(k=>finite(house.offsets?.[k]))&&close(sum(keys.map(k=>house.offsets[k])),0),'House effects must be a finite, zero-sum vector.');
    values=Object.fromEntries(keys.map(k=>[k,values[k]-house.offsets[k]]));
  }
  requireThat(!!demographic||!!house,'No supported adjustment exists for this poll.');
  requireThat(keys.every(k=>share(values[k]))&&close(sum(keys.map(k=>values[k])),100,.2),'Adjustment produced invalid shares; do not silently clip or rescale.');
  return {...poll,values:{lula:values.lula,flavio:values.flavio},responses:{other:values.other},moe:null,adjustment:{demographicApplied:!!demographic,houseEffectApplied:!!house,demographicDelta:demographic?.delta??null,houseOffsets:house?.offsets??null,engine:ENGINE_VERSION},rawValues:{...poll.values}};
}

// Evaluates already frozen OUTER-election holdouts; this does not fit a model.
export function assessBacktests(cases,policy,modelVersion){
  if(!Array.isArray(cases)||!cases.length||!policy)return {passed:false,reason:'missing-historical-validation'};
  requireThat(Number.isInteger(policy.minElections)&&policy.minElections>=2&&finite(policy.minimumMaeGain)&&policy.minimumMaeGain>=0&&finite(policy.minimumCoverage95)&&policy.minimumCoverage95>0&&policy.minimumCoverage95<=1&&finite(policy.maximumMeanWidth95)&&policy.maximumMeanWidth95>0,'Invalid preregistered validation policy.');
  requireThat(cases.every(c=>c.modelVersion===modelVersion&&c.outerHoldout===true&&Array.isArray(c.trainingElections)&&!c.trainingElections.includes(c.election)&&iso(c.cutoff)&&iso(c.electionDate)&&c.cutoff<c.electionDate&&iso(c.trainingCutoff)&&c.trainingCutoff<=c.cutoff&&sourceOK(c.outcomeSource)&&[c.actual,c.baseline,c.adjusted,c.lower95,c.upper95].every(finite)&&c.lower95<=c.upper95),'Historical validation contains leakage, missing provenance, or incompatible model versions.');
  // Score elections equally; many cutoffs from one election are not independent elections.
  const elections=[...new Set(cases.map(c=>c.election))];
  const scores=elections.map(e=>{const rows=cases.filter(c=>c.election===e),mean=fn=>sum(rows.map(fn))/rows.length;return {baselineMae:mean(c=>Math.abs(c.baseline-c.actual)),adjustedMae:mean(c=>Math.abs(c.adjusted-c.actual)),mse:mean(c=>(c.adjusted-c.actual)**2),coverage95:mean(c=>+(c.actual>=c.lower95&&c.actual<=c.upper95)),width95:mean(c=>c.upper95-c.lower95)};});
  const mean=k=>sum(scores.map(s=>s[k]))/scores.length;
  const metrics={elections:elections.length,baselineMae:mean('baselineMae'),adjustedMae:mean('adjustedMae'),rmse:Math.sqrt(mean('mse')),coverage95:mean('coverage95'),meanWidth95:mean('width95')};
  return {passed:metrics.elections>=policy.minElections&&metrics.baselineMae-metrics.adjustedMae>=policy.minimumMaeGain&&metrics.coverage95>=policy.minimumCoverage95&&metrics.meanWidth95<=policy.maximumMeanWidth95,metrics};
}

function generator(seed){let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const quantile=(sorted,p)=>{const x=(sorted.length-1)*p,i=Math.floor(x);return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(x-i);};

// Reduced-form conditional two-candidate VALID-VOTE model.
// Inputs must come from a documented upstream turnout/undecided calibration.
// Logistic composition keeps shares complementary, not independent candidate noise.
export function simulateRunoff(spec,{draws=20000,seed=20260920}={}){
  requireThat(spec?.basis==='valid votes'&&spec.conditionalMatchup==='Lula vs Flavio','Specify a conditional valid-vote runoff.');
  requireThat([spec.meanLogOddsFlavio,spec.currentLogitSd,spec.futureMeanLogitShift,spec.futureLogitSd,spec.currentFutureCorrelation].every(finite),'Missing calibrated simulation parameters.');
  requireThat(spec.currentLogitSd>=0&&spec.futureLogitSd>=0&&Math.abs(spec.currentFutureCorrelation)<=1,'Invalid uncertainty/correlation parameters.');
  requireThat(sourceOK(spec.calibrationArtifact)&&sourceOK(spec.turnoutUndecidedArtifact),'Calibration and turnout/undecided provenance required.');
  requireThat(Number.isInteger(draws)&&draws>=1000&&draws<=1000000&&Number.isInteger(seed),'Invalid simulation count or seed.');
  const random=generator(seed),values=[];let wins=0,ties=0;
  for(let i=0;i<draws;i++){
    const radius=Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,random()))),angle=2*Math.PI*random();
    const z1=radius*Math.cos(angle),z2=radius*Math.sin(angle),rho=spec.currentFutureCorrelation;
    const logit=spec.meanLogOddsFlavio+spec.currentLogitSd*z1+spec.futureMeanLogitShift+spec.futureLogitSd*(rho*z1+Math.sqrt(1-rho*rho)*z2);
    const f=100/(1+Math.exp(-logit));values.push(f);if(f>50)wins++;else if(f===50)ties++;
  }
  values.sort((a,b)=>a-b);const mean=sum(values)/draws,probability= wins/draws;
  return {draws,seed,flavioMean:mean,lulaMean:100-mean,flavioWinProbability:probability,lulaWinProbability:(draws-wins-ties)/draws,tieProbability:ties/draws,monteCarloSe:Math.sqrt(probability*(1-probability)/draws),intervals:Object.fromEntries([.5,.8,.95].map(level=>[level,[quantile(values,(1-level)/2),quantile(values,1-(1-level)/2)]])),histogram:Array.from({length:100},(_,i)=>({lower:i,upper:i+1,count:values.filter(v=>v>=i&&(v<i+1||(i===99&&v===100))).length})),basis:spec.basis,conditionalMatchup:spec.conditionalMatchup};
}

export function prepareAdjustedRelease(records,inputs){
  const reasons=[];
  if(!inputs?.corrections?.length)reasons.push('missing-wave-corrections');
  let validation={passed:false};
  try{validation=assessBacktests(inputs?.backtests,inputs?.validationPolicy,inputs?.modelVersion);if(!validation.passed)reasons.push('historical-validation-not-passed');}catch(error){reasons.push('invalid-historical-validation');}
  if(!inputs?.simulation)reasons.push('missing-simulation-calibration');
  if(!iso(inputs?.cutoff))reasons.push('missing-cutoff');
  const adjusted=[];
  for(const input of inputs?.corrections||[]){try{
    const poll=records.find(p=>p.id===input.pollId);
    requireThat(poll&&poll.published<=inputs.cutoff,'Unknown or future poll.');
    requireThat(input.modelVersion===inputs.modelVersion,'Correction model version mismatch.');
    adjusted.push(correctPoll(poll,input,{releaseCutoff:inputs.cutoff}));
  }catch(error){reasons.push('invalid-correction:'+input.pollId);}}
  if(new Set(adjusted.map(p=>p.id)).size!==adjusted.length)reasons.push('duplicate-wave');
  if(inputs?.simulation){const s=inputs.simulation;if(s.modelVersion!==inputs.modelVersion||s.cutoff!==inputs.cutoff||!Array.isArray(s.pollIds)||s.pollIds.length!==adjusted.length||s.pollIds.some(id=>!adjusted.some(p=>p.id===id)))reasons.push('simulation-input-mismatch');}
  if(reasons.length)return {status:'blocked',reasons,adjusted:[],simulation:null,validation,engine:ENGINE_VERSION};
  try{return {status:inputs.publicationApproved===true?'ready':'research',publicationApproved:inputs.publicationApproved===true,limitations:inputs.limitations||[],adjusted,simulation:simulateRunoff(inputs.simulation,inputs.simulationOptions),validation,engine:ENGINE_VERSION};}
  catch(error){return {status:'blocked',reasons:['invalid-simulation-calibration'],adjusted:[],simulation:null,validation,engine:ENGINE_VERSION};}
}
