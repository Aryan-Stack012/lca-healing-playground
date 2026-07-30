/* ============================================================
   LCA Playground — multi-tab / multi-window kit
   Shared by tabs.html, smart-tab.html, windows.html and every
   target document under tabs/ and windows/.

   Three jobs:
   1. Cross-context messaging, so a child tab/window can report
      back to its opener and the opener renders a LIVE readout.
      That is what makes "switch back to tab 1 and validate"
      assert something real instead of re-reading static copy.
   2. An open() wrapper + registry, so every page shows the tabs
      and windows it opened, in open order, as assertable DOM text.
   3. A Smart-Tab identity parser and score calculator that mirrors
      the spec's arithmetic — the page becomes its own oracle.

   No build step, no framework: same plain-JS voice as flag.js.
   ============================================================ */
(function (global) {
  var CHANNEL = 'lca-playground';

  /* Marketing / tracking query params the Smart-Tab score must ignore.
     Recording without them and replaying with them is the single most
     common way a URL-equality match breaks in the real world. */
  var TRACKING = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'ttclid', 'twclid',
    'li_fat_id', 'igshid', 'mc_cid', 'mc_eid', '_ga', '_gl', 'yclid', 's_kwcid',
    'epik', 'irclickid', 'cmpid', 'campaignid', 'adgroupid', 'ref', 'referrer'
  ];

  function isTracking(k) { return TRACKING.indexOf(String(k).toLowerCase()) > -1; }

  /* ---------------- cross-context channel ---------------- */
  /* BroadcastChannel covers tabs, popups and grandchild popups on the
     same origin. localStorage is the fallback leg so the readouts still
     land if a browser/flag combination has BroadcastChannel disabled. */
  var bc = null;
  try { bc = new BroadcastChannel(CHANNEL); } catch (e) { bc = null; }

  var listeners = [];

  /* Both legs are live at once, so the same message can arrive twice —
     once over BroadcastChannel and once via the storage event. Every
     message carries a per-document id and is delivered at most once:
     without this, one opened tab registers twice and one approval logs
     twice, which is exactly the kind of phantom a tab test must not have. */
  var ORIGIN = Math.random().toString(36).slice(2, 8);
  var seq = 0, seen = Object.create(null), seenOrder = [];
  function duplicate(msg) {
    var k = msg && msg._mid;
    if (!k) return false;
    if (seen[k]) return true;
    seen[k] = 1;
    seenOrder.push(k);
    if (seenOrder.length > 300) delete seen[seenOrder.shift()];
    return false;
  }

  function deliver(msg) {
    if (!msg || typeof msg !== 'object' || duplicate(msg)) return;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](msg); } catch (e) { /* one bad listener must not stop the rest */ }
    }
  }
  if (bc) bc.onmessage = function (ev) { deliver(ev.data); };
  global.addEventListener('storage', function (ev) {
    if (ev.key !== CHANNEL || !ev.newValue) return;
    try { deliver(JSON.parse(ev.newValue).msg); } catch (e) { }
  });

  function post(msg) {
    msg._mid = ORIGIN + '-' + (++seq);
    if (bc) { try { bc.postMessage(msg); } catch (e) { } }
    /* localStorage is the fallback leg only — writing it when
       BroadcastChannel is available just doubles every delivery. */
    if (!bc) {
      try { localStorage.setItem(CHANNEL, JSON.stringify({ at: Date.now(), msg: msg })); } catch (e) { }
    }
  }
  function on(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /* ---------------- identity (Smart-Tab properties) ---------------- */
  /* Deliberately reports the REAL deployed path, base prefix included.
     Hiding the /lca-healing-playground/ segments would make the score
     arithmetic on this page disagree with the product's. */
  function identity(loc, title) {
    loc = loc || global.location;
    var path = loc.pathname;
    var segments = path.split('/').filter(Boolean);
    var query = [];
    try {
      new URLSearchParams(loc.search).forEach(function (v, k) {
        query.push({ key: k, value: v, tracking: isTracking(k) });
      });
    } catch (e) { }
    return {
      url: loc.href,
      origin: loc.origin,
      domain: loc.hostname,           // captured, but never scored (per spec)
      path: path,
      segments: segments,
      query: query,
      fragment: loc.hash || '',
      title: title || document.title
    };
  }

  function scoringParams(id) { return id.query.filter(function (p) { return !p.tracking; }); }

  /* ---------------- Smart-Tab score ----------------
     Mirrors the spec: full path +10, individual path params
     (matches/total)*10, query key+value +5 / key-only +2,
     fragment +6 when it looks like an SPA route else +3,
     exact title +2. Domain is ignored on purpose.

     One documented interpretation: individual path params are matched
     order-independently and the denominator is the RECORDED segment
     count. The spec's worked example ("2 of 5 → 4") does not say
     whether position matters — verify the product's choice against
     this readout rather than assuming they agree. */
  function score(recorded, candidate) {
    var parts = [], total = 0;
    function add(label, points, detail) {
      points = Math.round(points * 100) / 100;
      total += points;
      parts.push({ label: label, points: points, detail: detail || '' });
    }

    if (recorded.path === candidate.path) {
      add('Full path exact', 10, recorded.path);
    } else {
      add('Full path exact', 0, recorded.path + ' ≠ ' + candidate.path);
    }

    var rs = recorded.segments, cs = candidate.segments;
    if (rs.length) {
      var pool = cs.slice(), hits = 0;
      for (var i = 0; i < rs.length; i++) {
        var at = pool.indexOf(rs[i]);
        if (at > -1) { hits++; pool.splice(at, 1); }
      }
      add('Path segments', (hits / rs.length) * 10, hits + ' of ' + rs.length + ' matched');
    }

    var rq = scoringParams(recorded);
    for (var j = 0; j < rq.length; j++) {
      var want = rq[j];
      var sameKey = candidate.query.filter(function (p) { return p.key === want.key; });
      var exact = sameKey.filter(function (p) { return p.value === want.value; });
      if (exact.length) add('Query ' + want.key + '=' + want.value, 5, 'key + value');
      else if (sameKey.length) add('Query ' + want.key, 2, 'key only (value differs)');
      else add('Query ' + want.key, 0, 'absent');
    }
    var ignored = candidate.query.filter(function (p) { return p.tracking; });
    if (ignored.length) {
      parts.push({
        label: 'Tracking params ignored', points: 0,
        detail: ignored.map(function (p) { return p.key; }).join(', ')
      });
    }

    var rf = recorded.fragment.replace(/^#/, '');
    if (rf) {
      var spa = rf.charAt(0) === '/';
      var weight = spa ? 6 : 3;
      var hit = recorded.fragment === candidate.fragment;
      add('Fragment ' + recorded.fragment, hit ? weight : 0, (spa ? 'SPA route' : 'anchor') + ' · max ' + weight);
    }

    add('Title exact', recorded.title === candidate.title ? 2 : 0, candidate.title);

    return { total: Math.round(total * 100) / 100, parts: parts };
  }

  /* ---------------- open() + registry ---------------- */
  var opened = [];   // everything this page opened, in open order
  var mounts = [];   // registry containers to keep painted

  function open(url, name, features) {
    var handle = null, blocked = false;
    try { handle = global.open(url, name || '_blank', features || ''); } catch (e) { handle = null; }
    if (!handle) blocked = true;
    var rec = {
      n: opened.length + 1,
      url: url,
      name: name || '_blank',
      kind: features ? 'window' : 'tab',
      handle: handle,
      blocked: blocked,
      status: blocked ? 'blocked' : 'open',
      title: '…',
      id: null
    };
    opened.push(rec);
    paint();
    return rec;
  }

  /* Children announce themselves with hello/bye; match them to the
     open() record by URL so the registry can show real titles and a
     real open/closed status rather than a guess. */
  on(function (msg) {
    if (!msg.type) return;
    var i, rec;
    if (msg.type === 'hello') {
      var matched = false;
      for (i = 0; i < opened.length; i++) {
        rec = opened[i];
        if (rec.id === null && sameDoc(rec.url, msg.url)) {
          rec.id = msg.id; rec.title = msg.title; rec.status = 'open'; matched = true; break;
        }
      }
      /* A tab opened from a target="_blank" anchor hands back no window
         handle, so adopt it from its own hello — otherwise the registry
         under-reports exactly the tabs a real user opens most often. */
      if (!matched) {
        opened.push({
          n: opened.length + 1, url: msg.url, name: '_blank', kind: 'tab',
          handle: null, blocked: false, status: 'open', title: msg.title, id: msg.id
        });
      }
      paint();
    } else if (msg.type === 'title') {
      for (i = 0; i < opened.length; i++) if (opened[i].id === msg.id) opened[i].title = msg.title;
      paint();
    } else if (msg.type === 'bye') {
      for (i = 0; i < opened.length; i++) if (opened[i].id === msg.id) opened[i].status = 'closed';
      paint();
    }
  });

  function sameDoc(a, b) {
    try {
      var ua = new URL(a, location.href), ub = new URL(b, location.href);
      return ua.pathname === ub.pathname && ua.search === ub.search;
    } catch (e) { return a === b; }
  }

  /* window.closed is readable for script-opened handles, so poll it as a
     second source of truth: a tab closed from the browser UI never sends bye. */
  setInterval(function () {
    var changed = false;
    for (var i = 0; i < opened.length; i++) {
      var rec = opened[i];
      if (rec.handle && rec.status === 'open') {
        try { if (rec.handle.closed) { rec.status = 'closed'; changed = true; } } catch (e) { }
      }
    }
    if (changed) paint();
  }, 1000);

  function registry(el) { if (el) { mounts.push(el); paint(); } }

  /* Every interpolated value below goes through esc(); titles and URLs
     arrive from same-origin child documents, but they are still page
     data, so they are escaped rather than trusted. */
  function paint() {
    for (var m = 0; m < mounts.length; m++) {
      var el = mounts[m];
      if (!opened.length) {
        el.innerHTML = '<p class="reg__empty" id="regEmpty">No tabs or windows opened yet.</p>';
        continue;
      }
      var html = '<div class="reg" role="list">';
      for (var i = 0; i < opened.length; i++) {
        var r = opened[i];
        var cls = r.status === 'open' ? 'badge--ok' : (r.status === 'blocked' ? 'badge--err' : 'badge--warn');
        html += '<div class="reg__row" role="listitem" data-idx="' + r.n + '" data-status="' + r.status + '">' +
          '<span class="reg__n mono">#' + r.n + '</span>' +
          '<span class="reg__kind badge ' + (r.kind === 'window' ? 'badge--info' : '') + '">' + r.kind + '</span>' +
          '<span class="reg__title">' + esc(r.title) + '</span>' +
          '<span class="reg__url mono">' + esc(tail(r.url)) + '</span>' +
          '<span class="reg__state badge ' + cls + '">' + r.status + '</span>' +
          '</div>';
      }
      html += '</div>';
      html += '<p class="reg__sum" id="regSummary">' + summary() + '</p>';
      el.innerHTML = html;
    }
  }

  function summary() {
    var o = 0, c = 0, b = 0;
    for (var i = 0; i < opened.length; i++) {
      if (opened[i].status === 'open') o++;
      else if (opened[i].status === 'closed') c++;
      else b++;
    }
    return 'Opened ' + opened.length + ' · open ' + o + ' · closed ' + c + ' · blocked ' + b;
  }

  function tail(u) {
    try { var x = new URL(u, location.href); return x.pathname.split('/').slice(-2).join('/') + x.search + x.hash; }
    catch (e) { return u; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  global.LCA = {
    post: post, on: on,
    identity: identity, score: score,
    isTracking: isTracking, TRACKING: TRACKING,
    open: open, registry: registry, opened: opened,
    esc: esc
  };
})(window);
