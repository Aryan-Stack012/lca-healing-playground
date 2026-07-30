/* ============================================================
   LCA Playground — target-document renderer
   Every document that gets OPENED in a new tab or window renders
   the same self-describing identity card from this one file, so
   two tabs differ only by their URL, title and label — never by
   their markup. Query params drive the behaviour:

     ?tab=B            label shown on the card and in the handoff
     ?title=…          explicit document title (else derived)
     ?code=…           handoff code (else HANDOFF-<label>)
     ?titledrift=ms    mutate document.title after ms (1 → 2500)
     ?autoclose=ms     window.close() itself after ms
     ?slow=ms          delay the interactive control by ms

   Readouts are live DOM text with stable ids and aria-live, which
   is what the agent's accessibility snapshot can actually see.
   ============================================================ */
(function () {
  var P = new URLSearchParams(location.search);
  function num(k, dflt) {
    var v = P.get(k);
    if (v === null) return 0;
    if (v === '1' || v === 'true') return dflt;
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  var label = P.get('tab') || 'A';
  var code = P.get('code') || ('HANDOFF-' + label);

  /* Channel id persists across THIS window's navigations (sessionStorage
     survives same-window navigation), so a document that redirects itself
     re-announces with the same id and the opener's registry updates one
     row instead of growing a phantom. Keyed by label because a child
     window INHERITS a copy of its opener's sessionStorage — a grandchild
     with a different label must not reuse its parent's id. */
  var idKey = 'lcaChanId:' + label, id = null;
  try { id = sessionStorage.getItem(idKey); } catch (e) { }
  if (!id) {
    id = label + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    try { sessionStorage.setItem(idKey, id); } catch (e) { }
  }

  /* Title: explicit override wins, else derive from EVERY path segment
     between the tabs/ directory and the leaf. Using only the immediate
     parent gave /cart/checkout and /store/cart/checkout the same title,
     which handed the superset path a title bonus it should never earn —
     two different paths must not collapse to one title by accident. */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var segs = location.pathname.split('/').filter(Boolean);
  var leaf = (segs.pop() || 'target.html').replace(/\.html?$/i, '');
  var at = segs.lastIndexOf('tabs');
  var mid = at > -1 ? segs.slice(at + 1) : [];
  document.title = P.get('title') ||
    (cap(leaf) + (mid.length ? ' — ' + mid.map(cap).join(' / ') : '') + ' · Tab ' + label);

  /* ---------------- identity card ---------------- */
  var idn = LCA.identity();
  var mount = document.getElementById('identity');

  function row(k, v, note) {
    return '<div class="row"><span class="row__k">' + LCA.esc(k) + '</span>' +
      '<span class="row__v">' + LCA.esc(v) +
      (note ? ' <span class="meta">' + LCA.esc(note) + '</span>' : '') + '</span></div>';
  }

  function renderIdentity() {
    idn = LCA.identity();
    var h = '<div class="rows">';
    h += row('Tab label', label);
    h += row('Document title', idn.title);
    h += row('Domain', idn.domain, 'captured · never scored');
    h += row('Full path', idn.path);
    h += row('Path segments', '[' + idn.segments.join(', ') + ']', idn.segments.length + ' segments');
    if (idn.query.length) {
      for (var i = 0; i < idn.query.length; i++) {
        var p = idn.query[i];
        h += row('Query · ' + p.key, p.value, p.tracking ? 'tracking · ignored by score' : 'scored');
      }
    } else {
      h += row('Query params', '(none)');
    }
    h += row('Fragment', idn.fragment || '(none)',
      idn.fragment ? (idn.fragment.charAt(1) === '/' ? 'SPA route · weight 6' : 'anchor · weight 3') : '');
    h += '</div>';
    if (mount) mount.innerHTML = h;

    var snap = document.getElementById('snapshot');
    if (snap) {
      snap.textContent = JSON.stringify({
        label: label, title: idn.title, path: idn.path, segments: idn.segments,
        query: idn.query, fragment: idn.fragment, handoffCode: code
      }, null, 2);
    }
  }
  renderIdentity();

  /* ---------------- label + heading ---------------- */
  var lab = document.getElementById('tabLabel');
  if (lab) lab.textContent = label;
  var hcode = document.getElementById('handoffCode');
  if (hcode) hcode.textContent = code;

  /* ---------------- announce to the opener ---------------- */
  /* The channel is origin-wide, so every message carries (1) the opener's
     registry token, read via window.opener (same-origin), which lets ONLY
     the opener adopt this tab, and (2) window.name, which open() set to a
     unique per-open value — the exact binding that separates identical twins. */
  var openerToken = null;
  try { openerToken = window.opener && window.opener.LCA ? window.opener.LCA.token : null; } catch (e) { }
  var winName = '';
  try { winName = window.name || ''; } catch (e) { }
  function announce(msg) {
    msg.openerToken = openerToken;
    msg.winName = winName;
    LCA.post(msg);
  }

  announce({ type: 'hello', id: id, label: label, url: location.href, title: document.title });
  window.addEventListener('pagehide', function () { announce({ type: 'bye', id: id, label: label }); });

  /* ---------------- the interactive control ---------------- */
  /* One action, one readout. The opener also receives the handoff, so
     "switch back to the first tab and validate" has a real observable. */
  var state = document.getElementById('state');
  var approve = document.getElementById('approve');

  function wire() {
    if (!approve) return;
    approve.disabled = false;
    approve.addEventListener('click', function () {
      var note = document.getElementById('note');
      var typed = note && note.value ? note.value : '';
      if (state) {
        state.textContent = 'Approved on tab ' + label + ' · ' + code + (typed ? ' · note "' + typed + '"' : '');
        state.className = 'is-ok';
      }
      approve.disabled = true;
      approve.textContent = 'Approved';
      announce({ type: 'handoff', id: id, label: label, code: code, note: typed, title: document.title });
    });
  }

  /* #waiting flips text after load — the ?slow scenario asserts on it,
     so it must be a live region the AX tree announces */
  var waiting = document.getElementById('waiting');
  if (waiting) { waiting.setAttribute('role', 'status'); waiting.setAttribute('aria-live', 'polite'); }

  var slow = num('slow', 3000);
  if (slow > 0 && approve) {
    approve.disabled = true;
    if (waiting) waiting.textContent = 'Control arms in ' + slow + ' ms…';
    setTimeout(function () {
      if (waiting) waiting.textContent = 'Control is live.';
      wire();
    }, slow);
  } else {
    if (waiting) waiting.textContent = 'Control is live.';
    wire();
  }

  /* ---------------- close-me ----------------
     window.close() only succeeds on script-opened windows. A tab opened
     from a target="_blank" anchor refuses — surface that instead of
     failing silently, because it is a real constraint on Close-tab steps. */
  var closeBtn = document.getElementById('closeMe');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      /* No pre-close bye: pagehide posts it if the close actually happens.
         Posting bye first left the opener's row 'closed' forever when the
         browser refused the close. */
      window.close();
      setTimeout(function () {
        var cs = document.getElementById('closeState');
        if (cs && !window.closed) {
          cs.textContent = 'Close refused by the browser — this tab keeps its own session history.';
          cs.className = 'is-bad';
        }
      }, 400);
    });
  }

  /* ---------------- title drift ----------------
     The spec captures tab properties BEFORE the action changes title/URL.
     A title that mutates after load is the scenario that catches a
     capture happening too late. */
  var drift = num('titledrift', 2500);
  if (drift > 0) {
    var dn = document.getElementById('driftNote');
    if (dn) dn.textContent = 'Title will mutate at +' + drift + ' ms.';
    setTimeout(function () {
      document.title = document.title + ' — updated';
      renderIdentity();
      announce({ type: 'title', id: id, title: document.title });
      if (dn) { dn.textContent = 'Title mutated to "' + document.title + '".'; dn.className = 'is-bad'; }
    }, drift);
  }

  /* ---------------- autoclose ---------------- */
  var auto = num('autoclose', 4000);
  if (auto > 0) {
    var an = document.getElementById('autoNote');
    var left = Math.ceil(auto / 1000);
    if (an) an.textContent = 'This tab closes itself in ' + left + 's.';
    var tick = setInterval(function () {
      left--;
      if (an) an.textContent = 'This tab closes itself in ' + Math.max(left, 0) + 's.';
      if (left <= 0) clearInterval(tick);
    }, 1000);
    setTimeout(function () {
      window.close();   // pagehide posts the bye when the close lands
    }, auto);
  }
})();
