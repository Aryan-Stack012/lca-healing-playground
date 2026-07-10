/* ============================================================
   Chrome Flag Inspector — detection engine
   Reads the browser this page runs in and reports which of the 8
   LCNC "Browser flags" (Advanced Configurations) actually took
   effect. Canonical arg/pref mapping mirrors lcnc-backend's
   lib/tasks/browser_flags.json. Honest about confidence: signals
   are marked definitive vs heuristic where Chrome hides the truth.

   HEADLESS-SAFE: every DOM write is null-guarded, so this engine
   also runs on pages without the probe cards (diff.html) and
   publishes results via window.FlagInspector + a "flags:updated"
   CustomEvent on document. One engine, several front-ends.

   Verdict -> semaphore (data-state): active=healthy, blocked=gone,
   heuristic/partial=drift, inactive=config.
   ============================================================ */
(function () {
  "use strict";

  var SUPPORTED_LANGS = [
    { label: "English (US)", value: "en-US" }, { label: "English (UK)", value: "en-GB" },
    { label: "Spanish", value: "es" }, { label: "Hindi (India)", value: "hi-IN" },
    { label: "French (France)", value: "fr" }, { label: "Spanish (Spain)", value: "es-ES" },
    { label: "Japanese (Japan)", value: "ja" }, { label: "Arabic", value: "ar" },
    { label: "Korean (Korea)", value: "ko" }, { label: "Chinese (China)", value: "zh-CN" },
    { label: "Russian (Russia)", value: "ru" }
  ];
  var GREET = {
    "en-US": "Hello", "en-GB": "Hello", "es": "¡Hola!", "es-ES": "¡Hola!", "fr": "Bonjour",
    "hi-IN": "नमस्ते", "ja": "こんにちは", "ar": "مرحبًا", "ko": "안녕하세요", "zh-CN": "你好", "ru": "Привет"
  };
  var CURRENCY = {
    "en-US": "USD", "en-GB": "GBP", "es": "EUR", "es-ES": "EUR", "fr": "EUR", "hi-IN": "INR",
    "ja": "JPY", "ar": "SAR", "ko": "KRW", "zh-CN": "CNY", "ru": "RUB"
  };

  var PARAMS = new URLSearchParams(location.search);

  // running report — serialized into the snapshot and broadcast to listeners.
  // applied keys are pre-initialized to null so every flag ALWAYS serializes in the JSON
  // snapshot (undefined would be silently dropped by JSON.stringify).
  var REPORT = {
    applied: { autoselect: null, camera: null, location: null, clipboard: null, incognito: null, blockall: null, dark: null },
    verdicts: {}, permissions: {}, environment: {},
    language: null, incognito: null, dark: null, camera_fake: false
  };

  /* ---------------- tiny helpers ---------------- */
  function byId(id) { return document.getElementById(id); }
  function safe(fn) { try { return fn(); } catch (e) { return null; } }
  function mq(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  function setText(id, v) { var el = byId(id); if (el) el.textContent = v; }
  function probe(flag) { return document.querySelector('.probe[data-flag="' + flag + '"]'); }
  function permCls(s) { return s === "granted" ? "ok" : s === "denied" ? "no" : s === "prompt" ? "warn" : "dim"; }

  // Record verdict (always) + paint the card (when present).
  function setState(el, state, verdictText, key) {
    key = key || (el && el.getAttribute("data-flag")) || null;
    if (key) REPORT.verdicts[key] = { state: state, verdict: verdictText };
    if (el) {
      el.setAttribute("data-state", state);
      var v = el.querySelector("[data-role=verdict]");
      if (v) {
        v.classList.remove("is-checking");
        v.textContent = verdictText;
        v.classList.remove("settle"); void v.offsetWidth; v.classList.add("settle");
      }
      // self-describing string the agent (DOM text / a11y tree) can assert on unambiguously
      var sum = el.querySelector("[data-role=summary]");
      if (sum) sum.textContent = (el.getAttribute("data-flag-name") || "") + " — " + verdictText;
    }
    updateSummary();
  }
  function ev(el, k, val, cls, group) {
    if (!el) return null;
    var list = el.querySelector("[data-role=ev]");
    if (!list) return null;
    var row = document.createElement("div"); row.className = "ev__row";
    if (group) row.setAttribute("data-g", group);
    var kEl = document.createElement("span"); kEl.className = "ev__k"; kEl.textContent = k;
    var vEl = document.createElement("span"); vEl.className = "ev__v" + (cls ? " " + cls : ""); vEl.textContent = val;
    row.appendChild(kEl); row.appendChild(vEl); list.appendChild(row);
    return vEl;
  }
  // A re-run replaces its own earlier evidence instead of stacking duplicates.
  function clearEv(el, group) {
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll('[data-role=ev] [data-g="' + group + '"]'), function (r) { r.remove(); });
  }
  async function safePermission(name) {
    try { var s = await navigator.permissions.query({ name: name }); return s.state; }
    catch (e) { return null; }
  }

  /* ---------------- environment panel ---------------- */
  function renderEnv() {
    var uaPlatform = safe(function () { return navigator.userAgentData && navigator.userAgentData.platform; });
    var env = {
      "User agent": navigator.userAgent,
      "navigator.language": navigator.language || "—",
      "navigator.languages": (navigator.languages || []).join(", ") || "—",
      "Intl locale": safe(function () { return Intl.DateTimeFormat().resolvedOptions().locale; }) || "—",
      "Time zone": safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }) || "—",
      "prefers-color-scheme": mq("(prefers-color-scheme: dark)") ? "dark" : (mq("(prefers-color-scheme: light)") ? "light" : "no-preference"),
      "navigator.webdriver": String(navigator.webdriver),
      "Platform": navigator.platform || uaPlatform || "—",
      "Device memory": navigator.deviceMemory != null ? navigator.deviceMemory + " GB" : "—",
      "CPU cores": navigator.hardwareConcurrency || "—",
      "Cookies enabled": String(navigator.cookieEnabled),
      "Screen": screen.width + "×" + screen.height + " @" + (window.devicePixelRatio || 1) + "x",
      "Secure context": String(window.isSecureContext)
    };
    REPORT.environment = env;
    var grid = byId("envgrid");
    if (!grid) return;
    Object.keys(env).forEach(function (k) {
      var cell = document.createElement("div"); cell.className = "env";
      var kEl = document.createElement("span"); kEl.className = "env__k"; kEl.textContent = k;
      var vEl = document.createElement("span"); vEl.className = "env__v" + (k === "User agent" ? " wrap-any" : ""); vEl.textContent = env[k];
      cell.appendChild(kEl); cell.appendChild(vEl); grid.appendChild(cell);
    });
  }

  /* ---------------- 8: Browser language (--lang / intl.accept_languages) ---------------- */
  function matchPreset(primary) {
    if (!primary) return null;
    var lower = primary.toLowerCase();
    var exact = SUPPORTED_LANGS.filter(function (l) { return l.value.toLowerCase() === lower; })[0];
    if (exact) return { preset: exact, kind: "exact" };
    // Chrome can normalize a requested UI locale (e.g. --lang=hi-IN -> navigator.language "hi"):
    // fall back to base-language matching so the preset is still attributed.
    var base = lower.split("-")[0];
    var baseMatch = SUPPORTED_LANGS.filter(function (l) { return l.value.toLowerCase().split("-")[0] === base; })[0];
    if (baseMatch) return { preset: baseMatch, kind: "base" };
    return null;
  }

  function detectLanguage() {
    var primary = navigator.language || "";
    var langs = navigator.languages || [];
    var intlLoc = safe(function () { return Intl.DateTimeFormat().resolvedOptions().locale; }) || primary;
    REPORT.language = { primary: primary, languages: langs.slice ? langs.slice() : langs, intl: intlLoc, acceptLanguage: null };

    var el = probe("language");
    setState(el, "config", primary || "unknown", "language");
    ev(el, "navigator.language", primary || "—", "ok");
    ev(el, "navigator.languages", (langs.join ? langs.join(", ") : String(langs)) || "—", "dim");
    ev(el, "Intl locale", intlLoc || "—", "dim");
    var m = matchPreset(primary);
    ev(el, "LCNC preset",
      m ? (m.preset.label + " (" + m.preset.value + ")" + (m.kind === "base" ? " — base-language match" : ""))
        : "not one of the 11 presets",
      m ? (m.kind === "exact" ? "ok" : "warn") : "warn");
    var al = deriveAcceptLanguage();
    REPORT.language.acceptLanguage = al.value;
    ev(el, "Accept-Language (derived)", al.value, al.cls);
    updateSummary();
  }

  // Chrome builds the Accept-Language request header from intl.accept_languages / --lang,
  // which is exactly what navigator.languages exposes. Derive it locally so the tool is
  // fully self-contained — no third-party echo, no network dependency, no console noise.
  function deriveAcceptLanguage() {
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages.slice()
      : (navigator.language ? [navigator.language] : []);
    if (!langs.length) return { value: "unavailable", cls: "dim" };
    var parts = langs.map(function (l, i) {
      if (i === 0) return l;
      return l + ";q=" + Math.max(0.1, 1 - i * 0.1).toFixed(1);
    });
    return { value: parts.join(","), cls: "ok" };
  }

  /* ---------------- 7: Dark mode (--enable-features=WebContentsForceDark) ---------------- */
  // Chrome's Auto Dark Mode: (a) it flips prefers-color-scheme to dark so dark-capable sites
  // serve their own theme; (b) for sites without dark support it algorithmically darkens the
  // paint output. Signal (b) IS JS-visible: force color-scheme:light on a probe element with
  // background-color:Canvas — computed white means no auto-darkening, non-white means the
  // darkening filter is engaged. The white swatch stays as the pixel ground truth.
  function canvasDarkProbe() {
    try {
      var d = document.createElement("div");
      d.style.cssText = "position:absolute;left:-9999px;top:0;width:8px;height:8px;color-scheme:light;background-color:Canvas;";
      document.body.appendChild(d);
      var bg = getComputedStyle(d).backgroundColor;
      document.body.removeChild(d);
      var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return { darkened: null, bg: bg };
      var lum = (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3;
      return { darkened: lum < 200, bg: bg };
    } catch (e) { return { darkened: null, bg: "unavailable" }; }
  }

  function detectDark() {
    var el = probe("dark");
    var prefersDark = mq("(prefers-color-scheme: dark)");
    var canvas = canvasDarkProbe();
    REPORT.dark = {
      prefersColorScheme: prefersDark ? "dark" : "light",
      forcedColors: mq("(forced-colors: active)"),
      canvasProbe: canvas.bg, canvasDarkened: canvas.darkened
    };
    if (canvas.darkened === true) { setState(el, "healthy", "On (auto-dark engaged)", "dark"); REPORT.applied.dark = true; }
    else if (prefersDark) { setState(el, "drift", "Media dark — verify swatch", "dark"); REPORT.applied.dark = null; }
    else { setState(el, "drift", "Check swatch", "dark"); REPORT.applied.dark = canvas.darkened === false && !prefersDark ? false : null; }
    ev(el, "canvas-color probe", canvas.bg + (canvas.darkened === true ? " → darkened" : canvas.darkened === false ? " → not darkened" : ""),
      canvas.darkened === true ? "ok" : "dim");
    ev(el, "prefers-color-scheme", prefersDark ? "dark" : "light", prefersDark ? "ok" : "warn");
    ev(el, "forced-colors", REPORT.dark.forcedColors ? "active" : "none", "dim");
    ev(el, "note", canvas.darkened === true
      ? "auto-dark filter detected via forced-light Canvas readback — flag active"
      : prefersDark
        ? "media reports dark (flag or OS/emulation) but no darkening filter on this element — swatch is the pixel truth"
        : "no dark signals — confirm via the white swatch on a run screenshot", "dim");
    updateSummary();
  }

  /* ---------------- 5: Incognito mode (--incognito) — quota heuristic is version-gated ---------------- */
  // Chrome 133+ deliberately killed quota-based incognito detection: storage.estimate() returns
  // an artificial usage + 10 GiB in BOTH modes (blink-dev "Quota API: hardcode quota"), so on
  // modern Chrome there is NO reliable JS signal — say so instead of guessing. On <133 the old
  // capped-quota-vs-fraction-of-disk gap still discriminates.
  function chromeMajor() {
    var m = (navigator.userAgent || "").match(/Chrome\/(\d+)/);
    return m ? Number(m[1]) : null;
  }

  async function detectIncognito() {
    var el = probe("incognito");
    var quota = null, usage = null;
    try { var est = await navigator.storage.estimate(); quota = est.quota; usage = est.usage; } catch (e) { }
    var gb = quota != null ? quota / 1073741824 : null;
    var major = chromeMajor();
    REPORT.incognito = { quotaBytes: quota, usageBytes: usage, quotaGB: gb, chromeMajor: major };

    var applied = null, verdict, state;
    if (major != null && major >= 133) {
      verdict = "No JS signal (133+)"; state = "drift";
    } else if (gb != null) {
      if (gb < 1) { applied = true; verdict = "Likely on"; state = "healthy"; }
      else if (gb > 4) { applied = false; verdict = "Likely off"; state = "config"; }
      else { verdict = "Ambiguous"; state = "drift"; }
    } else { verdict = "Unavailable"; state = "drift"; }
    REPORT.applied.incognito = applied;
    setState(el, state, verdict, "incognito");
    ev(el, "Chrome version", major != null ? String(major) : "unknown", "dim");
    ev(el, "storage quota", gb != null ? gb.toFixed(2) + " GB" : "unavailable", gb != null ? (applied === true ? "warn" : "dim") : "dim");
    ev(el, "storage usage", usage != null ? (usage / 1048576).toFixed(1) + " MB" : "—", "dim");
    ev(el, "heuristic", major != null && major >= 133
      ? "Chrome 133+ hardcodes quota to usage + 10 GiB in both modes — verify via the run's UI/video instead"
      : (gb != null ? (gb < 1 ? "capped quota → incognito" : gb > 4 ? "large quota → normal profile" : "mid-range → compare on/off") : "n/a"), "dim");
    updateSummary();
  }

  /* ---------------- passive permission states -> location / clipboard / camera / block-all ---------------- */
  async function detectPermissions() {
    var names = ["geolocation", "camera", "microphone", "clipboard-read", "clipboard-write", "notifications"];
    var states = {};
    await Promise.all(names.map(async function (n) { states[n] = await safePermission(n); }));
    states["notifications-api"] = (typeof Notification !== "undefined") ? Notification.permission : null;
    REPORT.permissions = states;

    // 3: Location access (geolocation pref 1/2)
    var loc = probe("location");
    var g = states.geolocation;
    if (g === "granted") { setState(loc, "healthy", "Allowed", "location"); REPORT.applied.location = true; }
    else if (g === "denied") { setState(loc, "gone", "Blocked", "location"); REPORT.applied.location = false; }
    else { setState(loc, "drift", g ? "Prompt" : "Unknown", "location"); REPORT.applied.location = null; }
    ev(loc, "permissions.geolocation", g || "unsupported", permCls(g));

    // 4: Clipboard access — clipboard-WRITE is auto-allowed in Chrome regardless of the pref,
    // so READ is the discriminator.
    var clip = probe("clipboard");
    var rd = states["clipboard-read"], wr = states["clipboard-write"];
    if (rd === "granted") { setState(clip, "healthy", "Allowed", "clipboard"); REPORT.applied.clipboard = true; }
    else if (rd === "denied") { setState(clip, "gone", "Blocked", "clipboard"); REPORT.applied.clipboard = false; }
    else { setState(clip, "drift", "Run probe", "clipboard"); REPORT.applied.clipboard = null; }
    ev(clip, "permissions.clipboard-read", rd || "unsupported", permCls(rd));
    ev(clip, "permissions.clipboard-write", wr || "unsupported (auto-allowed)", permCls(wr));

    // 2: Camera & microphone (passive part; final decided by the probe)
    var cam = probe("camera");
    ev(cam, "permissions.camera", states.camera || "unsupported", permCls(states.camera));
    ev(cam, "permissions.microphone", states.microphone || "unsupported", permCls(states.microphone));
    if (states.camera === "denied") { setState(cam, "gone", "Blocked", "camera"); REPORT.applied.camera = false; }
    else if (states.camera === "granted") { setState(cam, "healthy", "Granted", "camera"); REPORT.applied.camera = true; }
    else { setState(cam, "drift", "Run probe", "camera"); REPORT.applied.camera = null; }
    await passiveEnumerate(cam);

    // 6: Block all permissions (--deny-permission-prompts + geolocation=2) — aggregate heuristic.
    // Caveats: only geolocation is pref-forced; camera/mic may still query() as "prompt" while
    // actual requests auto-deny — assert on request rejection, not just query state. And
    // notifications-denied is NOT evidence here: --disable-notifications is an LCNC DEFAULT arg,
    // so it reads denied on every LCNC launch regardless of this flag.
    var block = probe("blockall");
    var notif = states["notifications-api"];
    var denied = ["geolocation", "camera", "microphone"].filter(function (n) { return states[n] === "denied"; }).length;
    var strong = denied >= 2;
    if (strong) { setState(block, "healthy", "Likely on", "blockall"); REPORT.applied.blockall = true; }
    else if (denied === 0) { setState(block, "config", "Likely off", "blockall"); REPORT.applied.blockall = false; }
    else { setState(block, "drift", "Partial", "blockall"); REPORT.applied.blockall = null; }
    ev(block, "Notification.permission", (notif || "unsupported") + " (not evidence — LCNC default)", "dim");
    ev(block, "geolocation", states.geolocation || "—", permCls(states.geolocation));
    ev(block, "camera", states.camera || "—", permCls(states.camera));
    ev(block, "microphone", states.microphone || "—", permCls(states.microphone));
    ev(block, "denied signals", denied + " of 3 (geolocation/camera/mic)", strong ? "warn" : "dim");
    updateSummary();
  }

  async function passiveEnumerate(cam) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      var devs = await navigator.mediaDevices.enumerateDevices();
      var labels = devs.map(function (d) { return d.label; }).filter(Boolean);
      var fake = labels.some(function (l) { return /fake|dummy/i.test(l); });
      ev(cam, "devices", devs.length + " (" + devs.map(function (d) { return d.kind; }).join(", ") + ")", "dim");
      if (labels.length) ev(cam, "device labels", labels.join(" · "), fake ? "ok" : "dim");
      if (fake) { setState(cam, "healthy", "Fake device", "camera"); REPORT.applied.camera = true; REPORT.camera_fake = true; }
    } catch (e) { }
  }

  /* ---------------- active probes (user-gesture wired + auto-run when pre-decided) ---------------- */
  async function probeMedia() {
    var cam = probe("camera");
    var btn = cam && cam.querySelector("[data-run]"); if (btn) btn.disabled = true;
    clearEv(cam, "media");
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      var tracks = stream.getTracks();
      var labels = tracks.map(function (t) { return t.kind + ":" + (t.label || "(no label)"); });
      var fake = tracks.some(function (t) { return /fake|dummy/i.test(t.label); });
      ev(cam, "getUserMedia", "resolved · " + tracks.length + " tracks", "ok", "media");
      ev(cam, "track labels", labels.join(" · "), fake ? "ok" : "", "media");
      setState(cam, "healthy", fake ? "Fake device" : "Granted", "camera");
      REPORT.applied.camera = true; REPORT.camera_fake = fake;
      tracks.forEach(function (t) { t.stop(); });
    } catch (e) {
      ev(cam, "getUserMedia(video+audio)", e.name + ": " + e.message, "no", "media");
      if (e.name === "NotAllowedError") { setState(cam, "gone", "Blocked", "camera"); REPORT.applied.camera = false; }
      else if (e.name === "NotFoundError") {
        // No combined device — on a VM this often means no real camera AND no fake device
        // (fake-device flag absent). Split video/audio for finer evidence.
        await probeMediaSplit(cam);
      }
      else setState(cam, "drift", e.name, "camera");
    } finally { if (btn) btn.disabled = false; updateSnap(); }
  }

  async function probeMediaSplit(cam) {
    var got = { video: false, audio: false };
    for (var i = 0; i < 2; i++) {
      var kind = i === 0 ? "video" : "audio";
      try {
        var c = {}; c[kind] = true;
        var s = await navigator.mediaDevices.getUserMedia(c);
        var t = s.getTracks()[0];
        ev(cam, "getUserMedia(" + kind + ")", "resolved · " + (t && t.label || "(no label)"), "ok", "media");
        if (t && /fake|dummy/i.test(t.label)) { REPORT.camera_fake = true; }
        s.getTracks().forEach(function (x) { x.stop(); });
        got[kind] = true;
      } catch (e2) {
        ev(cam, "getUserMedia(" + kind + ")", e2.name, e2.name === "NotAllowedError" ? "no" : "warn", "media");
      }
    }
    // audio-only success is NOT proof the flag applied: a missing video device with no fake
    // substitute means --use-fake-device-for-media-stream is absent. Only claim it on fake tracks.
    if (REPORT.camera_fake) { setState(cam, "healthy", "Fake device", "camera"); REPORT.applied.camera = true; }
    else if (got.video && got.audio) { setState(cam, "healthy", "Granted (real devices)", "camera"); REPORT.applied.camera = true; }
    else if (got.video || got.audio) { setState(cam, "drift", "Partial — no fake device", "camera"); REPORT.applied.camera = null; }
    else { setState(cam, "drift", "No device", "camera"); REPORT.applied.camera = null; }
  }

  async function probeScreen() {
    var el = probe("autoselect");
    var btn = el && el.querySelector("[data-run]"); if (btn) btn.disabled = true;
    clearEv(el, "screen");
    try {
      var t0 = performance.now();
      var stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      var dt = Math.round(performance.now() - t0);
      var tracks = stream.getTracks();
      var label = (tracks[0] && tracks[0].label) || "(no label)";
      var settings = (tracks[0] && tracks[0].getSettings) ? tracks[0].getSettings() : {};
      ev(el, "getDisplayMedia", "resolved in " + dt + "ms", "ok", "screen");
      ev(el, "source label", label, /screen|entire|monitor|fake/i.test(label) ? "ok" : "", "screen");
      ev(el, "displaySurface", settings.displaySurface || "—", settings.displaySurface === "monitor" ? "ok" : "", "screen");
      var auto = dt < 1200; // auto-select resolves instantly with no picker
      setState(el, auto ? "healthy" : "drift", auto ? "Auto-selected" : "Resolved (picker?)", "autoselect");
      REPORT.applied.autoselect = auto ? true : null;
      tracks.forEach(function (x) { x.stop(); });
    } catch (e) {
      ev(el, "getDisplayMedia", e.name + ": " + e.message, "no", "screen");
      setState(el, e.name === "NotAllowedError" ? "gone" : "drift",
        e.name === "NotAllowedError" ? "Denied/cancelled" : e.name, "autoselect");
      REPORT.applied.autoselect = e.name === "NotAllowedError" ? false : null;
    } finally { if (btn) btn.disabled = false; updateSnap(); }
  }

  async function probeLocation() {
    var el = probe("location");
    var btn = el && el.querySelector("[data-run]"); if (btn) btn.disabled = true;
    clearEv(el, "location");
    if (!navigator.geolocation) {
      ev(el, "geolocation API", "unsupported", "no", "location");
      setState(el, "drift", "Unsupported", "location"); REPORT.applied.location = null;
      if (btn) btn.disabled = false; updateSnap(); return;
    }
    await new Promise(function (res) {
      navigator.geolocation.getCurrentPosition(
        function (p) {
          ev(el, "getCurrentPosition", "resolved", "ok", "location");
          ev(el, "coords", p.coords.latitude.toFixed(3) + ", " + p.coords.longitude.toFixed(3), "ok", "location");
          setState(el, "healthy", "Allowed", "location"); REPORT.applied.location = true; res();
        },
        function (e) {
          ev(el, "getCurrentPosition", "error " + e.code + ": " + e.message, e.code === 1 ? "no" : "warn", "location");
          if (e.code === 1) { setState(el, "gone", "Blocked", "location"); REPORT.applied.location = false; }
          else setState(el, "drift", "Error", "location"); // POSITION_UNAVAILABLE etc: permission OK, no fix
          res();
        },
        { timeout: 6000, maximumAge: 0 }
      );
    });
    if (btn) btn.disabled = false; updateSnap();
  }

  async function probeClipboard() {
    var el = probe("clipboard");
    var btn = el && el.querySelector("[data-run]"); if (btn) btn.disabled = true;
    clearEv(el, "clipboard");

    // clipboard-READ is the discriminator (write is auto-allowed regardless of the pref), so a
    // successful read already proves pref = allow. The probe never writes: a write/restore
    // round-trip would destroy non-text clipboard content (images, files) with no way back.
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      ev(el, "navigator.clipboard", "unavailable (insecure context?)", "dim", "clipboard");
      setState(el, "drift", "Unavailable", "clipboard"); REPORT.applied.clipboard = null;
      if (btn) btn.disabled = false; updateSnap(); return;
    }

    try {
      var text = await navigator.clipboard.readText();
      ev(el, "clipboard.readText", "ok (" + String(text).length + " chars)", "ok", "clipboard");
      setState(el, "healthy", "Allowed", "clipboard"); REPORT.applied.clipboard = true;
    } catch (e) {
      // Chrome throws NotAllowedError both for permission denial AND for an unfocused document —
      // only the former means the pref blocked us.
      if (e.name === "NotAllowedError" && !document.hasFocus()) {
        ev(el, "clipboard.readText", "NotAllowedError (document not focused)", "warn", "clipboard");
        setState(el, "drift", "No focus — rerun", "clipboard"); REPORT.applied.clipboard = null;
      } else if (e.name === "NotAllowedError") {
        ev(el, "clipboard.readText", e.name + ": " + e.message, "no", "clipboard");
        setState(el, "gone", "Blocked", "clipboard"); REPORT.applied.clipboard = false;
      } else {
        ev(el, "clipboard.readText", e.name + ": " + e.message, "warn", "clipboard");
        setState(el, "drift", e.name, "clipboard"); REPORT.applied.clipboard = null;
      }
    }
    if (btn) btn.disabled = false; updateSnap();
  }

  // A probe can legitimately hang on a human browser (permission prompt left unanswered) —
  // cap each so the Run-all button always comes back.
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (res) { setTimeout(res, ms); })]);
  }

  async function runAll() {
    var b = byId("runAll"); if (b) { b.disabled = true; b.textContent = "Running…"; }
    // getDisplayMedia needs transient user activation — run it FIRST, while the
    // Run-all click is still fresh; the other probes don't need a gesture.
    await withTimeout(probeScreen(), 12000);
    await withTimeout(probeMedia(), 20000);
    await withTimeout(probeLocation(), 8000);
    await withTimeout(probeClipboard(), 8000);
    if (b) { b.disabled = false; b.textContent = "Run all probes again"; }
  }

  // Auto-run probes whose permission state query() reports as pre-decided (granted/denied), so
  // the page self-populates with zero clicks on most agentic runs. Skip anything still in
  // "prompt" — a human would get a dialog, and under --deny-permission-prompts query() can
  // still read "prompt" for camera/mic even though a request would auto-deny (those need the
  // Run-all button / agent click). ?noauto=1 disables. getDisplayMedia needs a gesture — never auto-run.
  async function autoRun() {
    if (PARAMS.has("noauto")) return;
    if (!document.querySelector(".probe")) return; // engine-only pages (language/diff) never auto-probe
    var p = REPORT.permissions || {};
    var decided = function (s) { return s === "granted" || s === "denied"; };
    if (decided(p.camera) && decided(p.microphone)) await probeMedia();
    if (decided(p.geolocation)) await probeLocation();
    if (decided(p["clipboard-read"])) await probeClipboard();
  }

  /* ---------------- summary + snapshot ---------------- */
  var BOOL_FLAGS = ["autoselect", "camera", "location", "clipboard", "incognito", "blockall", "dark"];
  function updateSummary() {
    var active = 0;
    BOOL_FLAGS.forEach(function (k) { if (REPORT.applied[k] === true) active++; });
    var m = byId("m-active");
    if (m) {
      var num = m.querySelector(".num"); if (num) num.textContent = active;
      m.setAttribute("data-state", active > 0 ? "healthy" : "config");
    }
    var chip = byId("flagCount"); if (chip) chip.textContent = active + " / 7 active";
    if (REPORT.language) setText("m-lang", REPORT.language.primary || "—");
    setText("m-dark", REPORT.applied.dark === true ? "on"
      : (REPORT.dark && REPORT.dark.prefersColorScheme === "dark") ? "media dark — check" : "check swatch");
    // single polite live region, debounced — init fires setState a dozen times in a burst,
    // and a screen reader should hear one settled summary, not twelve intermediate ones
    announceSummary(active + " of 7 boolean flags detected active. Browser language " + ((REPORT.language && REPORT.language.primary) || "unknown") + ".");
    updateSnap();
  }
  var announceTimer = null;
  function announceSummary(msg) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { setText("liveSummary", msg); }, 600);
  }

  function buildSnapshot() {
    return {
      generatedAt: new Date().toISOString(),
      url: location.href,
      flags: {
        "Auto select screen share": REPORT.applied.autoselect,
        "Camera & microphone": REPORT.applied.camera,
        "Location access": REPORT.applied.location,
        "Clipboard access": REPORT.applied.clipboard,
        "Incognito mode (heuristic)": REPORT.applied.incognito,
        "Block all permissions (heuristic)": REPORT.applied.blockall,
        "Dark mode": REPORT.applied.dark,
        "Browser language": REPORT.language && REPORT.language.primary
      },
      verdicts: REPORT.verdicts,
      environment: REPORT.environment,
      permissions: REPORT.permissions,
      language: REPORT.language,
      incognito: REPORT.incognito,
      dark: REPORT.dark,
      cameraFakeDevice: REPORT.camera_fake || false
    };
  }
  function updateSnap() {
    var snap = buildSnapshot();
    var pre = byId("snap");
    if (pre) pre.textContent = JSON.stringify(snap, null, 2);
    try { document.dispatchEvent(new CustomEvent("flags:updated", { detail: snap })); } catch (e) { }
  }

  function wireButtons() {
    var map = { media: probeMedia, screen: probeScreen, location: probeLocation, clipboard: probeClipboard };
    Array.prototype.forEach.call(document.querySelectorAll("[data-run]"), function (btn) {
      var kind = btn.getAttribute("data-run");
      if (map[kind]) btn.addEventListener("click", map[kind]);
    });
    var all = byId("runAll"); if (all) all.addEventListener("click", runAll);
    var copy = byId("copyReport");
    if (copy) copy.addEventListener("click", async function () {
      var text = JSON.stringify(buildSnapshot(), null, 2);
      try { await navigator.clipboard.writeText(text); copy.textContent = "Copied ✓"; }
      catch (e) {
        var pre = byId("snap"); if (pre) { var r = document.createRange(); r.selectNode(pre); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        copy.textContent = "Select-all → copy";
      }
      setTimeout(function () { copy.textContent = "Copy report"; }, 1800);
    });
  }

  function stagger() {
    if (mq("(prefers-reduced-motion: reduce)")) return;
    Array.prototype.forEach.call(document.querySelectorAll(".probe"), function (el, i) {
      el.style.animationDelay = (i * 55) + "ms";
      el.classList.add("reveal-up");
    });
  }

  /* ---------------- language deep-dive page ---------------- */
  function renderLanguagePage() {
    var loc = navigator.language || "en-US";
    var now = new Date();
    setText("bigLocale", loc || "—");
    setText("bigLangs", "[" + (navigator.languages || []).join(", ") + "]");

    // Chrome can normalize a preset locale (--lang=hi-IN -> "hi"); resolve currency through
    // the preset match so a correctly-configured run never falls back to USD.
    var preset = matchPreset(loc);
    var cur = CURRENCY[loc] || CURRENCY[loc.split("-")[0]] || (preset && CURRENCY[preset.preset.value]) || "USD";
    setText("s-date", safe(function () { return new Intl.DateTimeFormat(loc, { dateStyle: "full", timeStyle: "medium" }).format(now); }) || "—");
    setText("s-num", safe(function () { return new Intl.NumberFormat(loc).format(1234567.89); }) || "—");
    setText("s-cur", safe(function () { return new Intl.NumberFormat(loc, { style: "currency", currency: cur }).format(1299.5); }) || "—");
    setText("s-pct", safe(function () { return new Intl.NumberFormat(loc, { style: "percent" }).format(0.8642); }) || "—");
    setText("s-rel", safe(function () { return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(-2, "day"); }) || "—");
    setText("s-list", safe(function () { return new Intl.ListFormat(loc, { style: "long", type: "conjunction" }).format(["Chrome", "Edge", "Firefox"]); }) || "—");
    setText("s-accept", deriveAcceptLanguage().value);

    var tbody = byId("localeBody");
    if (tbody) {
      var td = function (cls, text, dir) {
        var c = document.createElement("td");
        if (cls) c.className = cls;
        if (dir) c.setAttribute("dir", dir);
        c.textContent = text;
        return c;
      };
      var m = matchPreset(loc);
      SUPPORTED_LANGS.forEach(function (l) {
        var active = m && m.preset.value === l.value;
        var d = safe(function () { return new Intl.DateTimeFormat(l.value, { dateStyle: "medium" }).format(now); }) || "—";
        var n = safe(function () { return new Intl.NumberFormat(l.value).format(1234567.89); }) || "—";
        var tr = document.createElement("tr"); if (active) tr.className = "is-active";
        var codeCell = td("code", l.value);
        if (active) {
          // real DOM text (not CSS ::after) so DOM-reading agents can assert on "active"
          var tag = document.createElement("span"); tag.className = "active-tag"; tag.textContent = " ◂ active";
          codeCell.appendChild(tag);
        }
        tr.appendChild(codeCell);
        tr.appendChild(td(null, l.label));
        tr.appendChild(td("greet", GREET[l.value], "auto"));
        tr.appendChild(td("fmt", d, "auto"));
        tr.appendChild(td("fmt", n));
        tbody.appendChild(tr);
      });
    }
  }

  /* ---------------- init ---------------- */
  async function init() {
    renderEnv();
    detectLanguage();
    detectDark();
    // Auto-select screen share has no passive signal — resolve it only when captured.
    var as = probe("autoselect");
    setState(as, "drift", "Run probe", "autoselect");
    ev(as, "status", "not yet captured — click Capture screen or Run all probes", "dim", "screen");
    wireButtons();
    if (byId("localeBody")) renderLanguagePage();
    stagger();
    await detectIncognito();
    await detectPermissions();
    updateSnap();
    await autoRun();
    updateSnap();
  }

  // Public API for sibling pages (diff.html): same engine, different front-end.
  window.FlagInspector = {
    snapshot: buildSnapshot,
    report: REPORT,
    presets: SUPPORTED_LANGS,
    matchPreset: matchPreset,
    probes: { media: probeMedia, screen: probeScreen, location: probeLocation, clipboard: probeClipboard },
    runAll: runAll
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
