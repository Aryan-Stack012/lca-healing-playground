// Break-state resolver. Same URL throughout.
// lcaResolve() -> {state, source}
//   state  : 'healthy' | 'drift' | 'gone'
//   source : 'url_gone' | 'url_drift' | 'local' | 'flag'   (precedence: URL > localStorage > flag.json)
// Legacy helpers keep their original contracts so saved tests never change:
//   lcaState() -> false (healthy) | true (drifted, healable) | 'gone' (unhealable)
async function lcaResolve(){
  try{
    var p = new URLSearchParams(location.search);
    if(p.has('gone'))                          return {state:'gone',  source:'url_gone'};
    if(p.get('v')==='2' || p.has('break'))     return {state:'drift', source:'url_drift'};
    if(localStorage.getItem('lcaBreak')==='1') return {state:'drift', source:'local'};
    var r = await fetch('flag.json?cb='+Date.now(), {cache:'no-store'});
    var j = await r.json();
    return {state: j.break==='gone' ? 'gone' : (j.break===true ? 'drift' : 'healthy'), source:'flag'};
  }catch(e){ return {state:'healthy', source:'flag'}; }
}
async function lcaState(){ var s=(await lcaResolve()).state; return s==='gone' ? 'gone' : s==='drift'; }
async function lcaBreak(){ return (await lcaResolve()).state==='drift'; }
async function lcaGone(){  return (await lcaResolve()).state==='gone'; }
