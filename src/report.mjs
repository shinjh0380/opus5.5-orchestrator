import fs from "node:fs/promises";
import path from "node:path";
export async function writeReport(dir, receipt) {
  const data = JSON.stringify({
    ...receipt,
    source: undefined,
    baseline: undefined,
  }).replaceAll("<", "\\u003c");
  await fs.writeFile(
    path.join(dir, "report.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Opus Orchestrator · Run report</title><style>
  *{box-sizing:border-box}body{margin:0;background:#10131a;color:#f5f4ef;font:18px system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:56px 48px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #374151;padding-bottom:20px}small{color:#a3acb9}h1{font-size:44px;margin:28px 0 10px}h2{font-size:23px;margin-top:32px}.tag{border:1px solid #638a75;padding:8px 15px;border-radius:30px;color:#b4f4d3}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:30px 0}.card,.lane{background:#1b222c;border-radius:14px;padding:24px}.value{font-size:40px;font-weight:700;margin-top:10px}.lane{display:grid;grid-template-columns:170px 1fr 260px;gap:20px;align-items:center;margin:12px 0}.track{height:12px;background:#303a47;border-radius:20px;overflow:hidden;margin-top:12px}.bar{height:100%;background:#a6e6c8}.money{color:#a6e6c8}pre{white-space:pre-wrap;font-size:15px;line-height:1.5;max-height:340px;overflow:auto;background:#171e27;padding:24px;border-radius:12px}button{color:#eee;background:#263747;border:0;padding:12px 20px;border-radius:8px;cursor:pointer}p{line-height:1.6}footer{font-size:14px;color:#a3acb9;margin-top:30px}
  </style><main><header><b>OPUS ORCHESTRATOR</b><span class="tag" id="status"></span></header><h1>From plan to checks: the run record</h1><p id="goal"></p><div class="cards" id="cards"></div><h2>Work by model</h2><div id="lanes"></div><h2>Actual check results</h2><div id="checks"></div><footer id="note"></footer></main><script>
  const r=${data};const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
  document.querySelector('#status').textContent=r.status.toUpperCase();document.querySelector('#goal').textContent=r.goal;
  const input=r.calls.reduce((n,c)=>n+(c.usage?.input_tokens||0),0),cached=r.calls.reduce((n,c)=>n+(c.usage?.cached_input_tokens||0),0),output=r.calls.reduce((n,c)=>n+(c.usage?.output_tokens||0),0),known=r.calls.length&&r.calls.every(c=>c.price.kind==='standard-equivalent'),cost=r.calls.reduce((n,c)=>n+(c.price.usd||0),0);
  for(const [a,b]of [['Input / output',input.toLocaleString()+' / '+output.toLocaleString()],['Cached input share',input?(100*cached/input).toFixed(1)+'%':'—'],['Standard API equivalent',known?'$'+cost.toFixed(4):'See measurement scope']]){const c=el('div','','card');c.append(el('small',a),el('div',b,'value'));document.querySelector('#cards').append(c)}
  const max=Math.max(1,...r.calls.map(c=>c.seconds));for(const c of r.calls){const lane=el('div','','lane');const name=el('div',c.id);name.append(el('small',' · '+c.role));const detail=el('div',c.modelRequested+' / '+c.effort);const track=el('div','','track'),bar=el('div','','bar');bar.style.width=(100*c.seconds/max)+'%';track.append(bar);detail.append(track);lane.append(name,detail,el('div',c.seconds.toFixed(1)+'s · '+(c.price.usd===undefined?'N/A':'$'+c.price.usd.toFixed(4)),'money'));document.querySelector('#lanes').append(lane)}
  for(const c of r.checks){const d=el('details');const s=el('summary',(c.passed?'PASS':'FAIL')+' · '+c.argv.join(' '));d.append(s,el('pre',c.stdout+'\\n'+c.stderr));document.querySelector('#checks').append(d)}
  const esc=(r.escalations||[]).length,aux=r.calls.reduce((n,c)=>n+(c.auxiliary||[]).length,0);document.querySelector('#note').textContent='Started '+r.startedAt+' · '+r.pricing.assumption+' · Rates as of '+r.pricing.asOf+'. Model labels are pinned CLI request settings'+(r.provider==='anthropic'?' plus the CLI per-model usage key':'')+', not independent backend verification. Cache hits are not guaranteed.'+(esc?' Escalations: '+r.escalations.map(e=>e.task+' → '+e.to+' ('+e.reason.split(':')[0]+(e.executed===false?', not run':'')+')').join(', ')+'.':'')+(aux?' Auxiliary host-model usage is recorded in receipt.json and excluded from the per-call estimate.':'');
  </script></html>`,
  );
}
