// Diagram geometry only. No statistical calculations or simulated outcomes.
export function connectMethodology(){
  const canvas=document.querySelector('.flow-canvas');if(!canvas)return;
  const svg=canvas.querySelector('svg'),nodes=[...canvas.querySelectorAll('.method-flow>li>a')];
  function draw(){
    const root=canvas.getBoundingClientRect(),w=root.width,h=root.height;
    const boxes=nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.left-root.left,y:r.top-root.top,w:r.width,h:r.height};});
    if(!w||!h)return;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const markers=['forward','retry','replay'].map((id,i)=>`<marker id="flow-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="var(${['--chart-reference','--series-ochre','--series-mauve'][i]})"/></marker>`).join('');
    let paths='';
    for(let i=0;i<boxes.length-1;i++){
      const a=boxes[i],b=boxes[i+1];let d;
      if(Math.abs(a.y-b.y)<2){const right=b.x>a.x;d=`M${right?a.x+a.w:a.x},${a.y+a.h/2}H${right?b.x-3:b.x+b.w+3}`;}
      else d=`M${a.x+a.w/2},${a.y+a.h}V${b.y-3}`;
      paths+=`<path class="flow-forward" data-from="${i+1}" data-to="${i+2}" d="${d}" marker-end="url(#flow-forward)"/>`;
    }
    // A failed Monte Carlo replay returns through the outside lane to matching.
    const reject=boxes[12],match=boxes[4],reviewY=match.y-12;
    paths+=`<path class="flow-retry" data-from="13" data-to="5" d="M${reject.x},${reject.y+reject.h*.68}H7V${reviewY}H${match.x+match.w*.3}V${match.y-3}" marker-end="url(#flow-retry)"/>`;
    svg.innerHTML=`<defs>${markers}</defs>${paths}`;
  }
  new ResizeObserver(draw).observe(canvas);
  document.fonts.ready.then(draw);draw();
}
