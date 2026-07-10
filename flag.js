// Break-state resolver. Same URL throughout.
// lcaResolve() -> {state, source}
//   state  : 'healthy' | 'drift' | 'gone'
//   source : 'url_gone' | 'url_drift' | 'local' | 'flag' | 'fallback'
//            (precedence: URL > localStorage > flag.json; 'fallback' = flag.json unreachable)
// Legacy helpers keep their original contracts so saved tests never change:
//   lcaState() -> false (healthy) | true (drifted, healable) | 'gone' (unhealable)
function lcaFlagParam(p, k){
  if(!p.has(k)) return false;
  var v = p.get(k);
  return !(v === '0' || v === 'false' || v === 'off');
}
async function lcaResolve(){
  var p = null;
  try{ p = new URLSearchParams(location.search); }catch(e){}
  if(p){
    if(lcaFlagParam(p, 'gone'))                        return {state:'gone',  source:'url_gone'};
    if(p.get('v') === '2' || lcaFlagParam(p, 'break')) return {state:'drift', source:'url_drift'};
  }
  try{ if(localStorage.getItem('lcaBreak') === '1')    return {state:'drift', source:'local'}; }catch(e){}
  try{
    var r = await fetch('flag.json?cb=' + Date.now(), {cache:'no-store'});
    var j = await r.json();
    return {state: j.break === 'gone' ? 'gone' : (j.break === true ? 'drift' : 'healthy'), source:'flag'};
  }catch(e){ return {state:'healthy', source:'fallback'}; }
}
async function lcaState(){ var s = (await lcaResolve()).state; return s === 'gone' ? 'gone' : s === 'drift'; }
async function lcaBreak(){ return (await lcaResolve()).state === 'drift'; }
async function lcaGone(){  return (await lcaResolve()).state === 'gone'; }
