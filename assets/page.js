// Shared chrome for every target page: skip link, sticky top bar (brand → hub),
// and a live break-flag chip wired to the same resolver the page uses (flag.js).
(function(){
  if(typeof lcaResolve !== 'function') return;
  var WORD = { healthy:'healthy', drift:'drifted', gone:'unhealable' };
  var sub = document.body.dataset.sub || '';

  // A ?v=2/?break/?gone override is per-tab state — keep carrying it on in-playground
  // navigation so the hub you land on reports the same state this page ran under.
  function overrideQuery(){
    try{
      var p = new URLSearchParams(location.search), keep = new URLSearchParams();
      ['v','break','gone'].forEach(function(k){ if(p.has(k)) keep.set(k, p.get(k)); });
      var q = keep.toString();
      return q ? '?' + q : '';
    }catch(e){ return ''; }
  }

  var skip = document.createElement('a');
  skip.className = 'skip'; skip.href = '#main'; skip.textContent = 'Skip to content';
  document.body.insertBefore(skip, document.body.firstChild);

  var bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML =
    '<div class="topbar__in">' +
      '<a class="brand" href="index.html" aria-label="Back to the playground hub">' +
        '<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true">' +
          '<rect x="1" y="1" width="38" height="38" rx="10" fill="#0C111E" stroke="#233048"/>' +
          '<path d="M5 21 H13 L16 12 L20 28 L24 16 L26 21 H35" fill="none" stroke="#3FE0A6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
        '<span class="brand__txt"><span class="brand__name">Self-Healing Playground</span><span class="brand__sub"></span></span>' +
      '</a>' +
      '<span class="flagchip" id="pgFlag"><span class="flagchip__dot"></span><span class="flagchip__label">flag</span><span class="flagchip__state">…</span></span>' +
    '</div>';
  bar.querySelector('.brand__sub').textContent = sub;
  bar.querySelector('.brand').setAttribute('href', 'index.html' + overrideQuery());
  document.body.insertBefore(bar, skip.nextSibling);

  var chip = document.getElementById('pgFlag');
  var stEl = chip.querySelector('.flagchip__state');
  var resolving = false;
  function paint(){
    if(resolving) return; resolving = true;
    Promise.resolve(lcaResolve()).then(function(r){
      chip.setAttribute('data-state', r.state);
      stEl.textContent = WORD[r.state] || r.state;
    }).catch(function(){}).then(function(){ resolving = false; });
  }
  paint();
  // shared flag lands ~30–60s after a toggle; poll only while the tab is visible
  setInterval(function(){ if(!document.hidden) paint(); }, 20000);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) paint(); });
})();
