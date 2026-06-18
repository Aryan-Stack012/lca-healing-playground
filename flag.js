// Break-state resolver. Same URL throughout.
// Returns: false (healthy) | true (v2 broken-but-healable) | "gone" (button removed = unhealable).
async function lcaState(){
  try{
    var p=new URLSearchParams(location.search);
    if(p.has('gone')) return 'gone';
    if(p.get('v')==='2'||p.has('break')) return true;
    if(localStorage.getItem('lcaBreak')==='1') return true;
    var r=await fetch('flag.json?cb='+Date.now(),{cache:'no-store'});
    var j=await r.json();
    return j.break;
  }catch(e){ return false; }
}
async function lcaBreak(){ var s=await lcaState(); return s===true||s==='v2'; }
async function lcaGone(){ return (await lcaState())==='gone'; }