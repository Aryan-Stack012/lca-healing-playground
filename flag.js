// Shared break-state resolver. Same URL the whole time.
// Priority: ?v=2 / ?break (manual)  >  localStorage.lcaBreak=1 (same browser)  >  flag.json (shared, toggled via the toggle-heal Action).
async function lcaBreak(){
  try{
    var p=new URLSearchParams(location.search);
    if(p.get('v')==='2'||p.has('break')) return true;
    if(localStorage.getItem('lcaBreak')==='1') return true;
    var r=await fetch('flag.json?cb='+Date.now(),{cache:'no-store'});
    var j=await r.json();
    return !!j.break;
  }catch(e){ return false; }
}