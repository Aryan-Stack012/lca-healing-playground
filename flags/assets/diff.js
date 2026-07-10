/* ============================================================
   Launch Diff — default command line vs. detected additions
   A webpage cannot read Chrome's command line, so this page does
   the honest version of a "live diff":
     1. Renders the DEFAULT LCNC launch command line (verbatim,
        source-attributed: LCNC DEFAULT_ARGS vs chromedriver's own
        defaults vs per-run values).
     2. VERIFIES the baseline args that have JS-observable effects
        (webdriver, window.gc, File System Access stripped, autoplay
        policy, notifications, srgb gamut, the LCNC recorder markers…).
     3. Overlays the EXTRA args/prefs inferred live from the 8 user
        browser flags — detection comes from the shared inspector
        engine (inspector.js → "flags:updated" events).
   Sources: lcnc-app/chromeDefaultArgs.js (DEFAULT_ARGS),
   lcnc-app/utils/BrowserFlagsHandler.js (merge semantics),
   lcnc-services preCreateSeleniumSession.js (live agentic launch),
   lcnc-backend lib/tasks/browser_flags.json (flag → args/prefs).
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- fingerprint checks (JS-observable baseline args) ---------------- */
  // Each check: id, label, arg it verifies, run() -> {pass:true|false|null, detail}
  var CHECKS = {
    webdriver: {
      label: "navigator.webdriver",
      arg: "--enable-automation",
      kind: "strong",
      run: function () {
        var v = navigator.webdriver === true;
        return {
          pass: v,
          detail: v ? "true — automation launch confirmed"
            : "false — either not automation-launched, or AutomationControlled was disabled (LCNC disableAutomationControlled)"
        };
      }
    },
    gc: {
      label: "window.gc exposed",
      arg: "--js-flags=--expose-gc",
      kind: "strong",
      run: function () {
        var v = typeof window.gc === "function";
        return { pass: v, detail: v ? "function — V8 launched with --expose-gc" : "undefined — expose-gc not in effect" };
      }
    },
    fsaccess: {
      label: "File System Access stripped",
      arg: "--disable-blink-features=…FileSystemAccess…",
      kind: "strong",
      run: function () {
        var gone = ["showOpenFilePicker", "showSaveFilePicker", "showDirectoryPicker"].filter(function (n) { return window[n] === undefined; });
        var obs = typeof window.FileSystemObserver === "undefined";
        var legacy = typeof window.webkitRequestFileSystem === "undefined";
        var all = gone.length === 3 && obs && legacy;
        return {
          pass: all ? true : (gone.length === 0 ? false : null),
          detail: "pickers gone: " + gone.length + "/3 · FileSystemObserver " + (obs ? "gone" : "present") + " · webkitRequestFileSystem " + (legacy ? "gone" : "present")
        };
      }
    },
    opfs: {
      label: "OPFS survives (expected)",
      arg: "navigator.storage.getDirectory",
      kind: "info",
      run: function () {
        var v = !!(navigator.storage && navigator.storage.getDirectory);
        return { pass: v ? true : null, detail: v ? "present — OPFS is not gated by the FileSystemAccess picker feature" : "absent" };
      }
    },
    autoplay: {
      label: "Autoplay without gesture",
      arg: "--autoplay-policy=no-user-gesture-required",
      kind: "strong",
      run: function () {
        try {
          var Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return { pass: null, detail: "AudioContext unavailable" };
          var ctx = new Ctx();
          var st = ctx.state;
          ctx.close();
          return {
            pass: st === "running",
            detail: "AudioContext.state = " + st + (st === "running" ? " — autoplay allowed with no gesture" : " — gated on user gesture (standard policy)")
          };
        } catch (e) { return { pass: null, detail: e.name }; }
      }
    },
    notifications: {
      label: "Notifications disabled",
      arg: "--disable-notifications",
      kind: "heuristic",
      run: function () {
        if (typeof Notification === "undefined") return { pass: true, detail: "window.Notification undefined" };
        var p = Notification.permission;
        return { pass: p === "denied" ? true : (p === "granted" ? false : null), detail: "Notification.permission = " + p };
      }
    },
    gamut: {
      label: "Color gamut pinned to sRGB",
      arg: "--force-color-profile=srgb",
      kind: "heuristic",
      run: function () {
        var p3 = matchMedia("(color-gamut: p3)").matches;
        var srgb = matchMedia("(color-gamut: srgb)").matches;
        return {
          pass: p3 ? false : (srgb ? null : null),
          detail: "p3: " + p3 + " · srgb: " + srgb + (p3 ? " — wide gamut visible, srgb forcing NOT in effect" : " — consistent with forced sRGB (or a non-P3 display)")
        };
      }
    },
    extension: {
      label: "LCNC recorder present",
      arg: "--load-extension=…/lcnc-extension (+ injected scripts)",
      kind: "heuristic",
      run: function () {
        var tags = ["low-code-shadow-extension", "low-code-root", "low-code-container", "low-code-highlight", "low-code-selector", "low-code-modal"];
        var found = tags.filter(function (t) { return document.getElementsByTagName(t).length > 0 || document.querySelector("." + t) || document.getElementById(t); });
        var globals = ["lcaLoaderRenderPromise", "waitForLCAPendingXHRs", "getBstackLCAFlags"].filter(function (g) { return typeof window[g] !== "undefined"; });
        var hit = found.length > 0 || globals.length > 0;
        return {
          pass: hit ? true : null,
          detail: hit ? ("markers: " + found.concat(globals.map(function (g) { return "window." + g; })).join(", "))
            : "no markers yet — content script/init script may inject later, or this is not an LCNC-launched Chrome"
        };
      }
    }
  };

  /* ---------------- default command lines ---------------- */
  // src: 'lcnc' = lcnc-app/chromeDefaultArgs.js DEFAULT_ARGS · 'driver' = chromedriver's own
  // defaults (added at launch, not in LCNC code) · 'run' = varies per run/machine.
  // check: id in CHECKS verifying this arg · legacy: switch no longer recognized by Chrome.
  var DESKTOP_ARGS = [
    { a: "--allow-insecure-localhost", src: "lcnc" },
    { a: "--allow-pre-commit-input", src: "driver" },
    { a: "--autoplay-policy=no-user-gesture-required", src: "lcnc", check: "autoplay" },
    { a: "--disable-background-networking", src: "driver" },
    { a: "--disable-background-timer-throttling", src: "driver" },
    { a: "--disable-backgrounding-occluded-windows", src: "lcnc" },
    { a: "--disable-blink-features=FileHandling,FileHandlingIcons,FileSystem,FileSystemAccess,FileSystemAccessAPIExperimental,FileSystemAccessGetCloudIdentifiers,FileSystemAccessLocal,FileSystemAccessLockingScheme,FileSystemAccessOriginPrivate,FileSystemObserver,FileSystemObserverUnobserve", src: "lcnc", check: "fsaccess" },
    { a: "--disable-client-side-phishing-detection", src: "driver" },
    { a: "--disable-crash-reporter", src: "lcnc" },
    { a: "--disable-default-apps", src: "driver" },
    { a: "--disable-dev-shm-usage", src: "lcnc" },
    { a: "--disable-device-discovery-notifications", src: "lcnc" },
    { a: "--disable-features=IgnoreDuplicateNavs,Prewarm,CookieDeprecationFacilitatedTesting,TrackingProtection3pcd,WebPayments,DisableLoadExtensionCommandLineSwitch", src: "lcnc", note: "chromedriver merged its own list (IgnoreDuplicateNavs, Prewarm) with LCNC's two --disable-features entries" },
    { a: "--disable-hang-monitor", src: "lcnc" },
    { a: "--disable-infobars", src: "lcnc" },
    { a: "--disable-new-avatar-menu", src: "lcnc", legacy: true },
    { a: "--disable-new-profile-management", src: "lcnc", legacy: true },
    { a: "--disable-notifications", src: "lcnc", check: "notifications" },
    { a: "--disable-password-generation", src: "lcnc", legacy: true },
    { a: "--disable-popup-blocking", src: "lcnc", note: "verify on demand with the popup probe below" },
    { a: "--disable-print-preview", src: "lcnc" },
    { a: "--disable-prompt-on-repos", src: "lcnc", note: "shipped typo of --disable-prompt-on-repost (chromeDefaultArgs.js:38) — unknown switch, Chrome ignores it" },
    { a: "--disable-prompt-on-repost", src: "lcnc" },
    { a: "--disable-renderer-backgrounding", src: "lcnc" },
    { a: "--disable-restore-session-state", src: "lcnc", legacy: true },
    { a: "--disable-search-engine-choice-screen", src: "lcnc" },
    { a: "--disable-single-click-autofill", src: "lcnc", legacy: true },
    { a: "--disable-site-isolation-trials", src: "lcnc" },
    { a: "--disable-sync", src: "driver" },
    { a: "--enable-automation", src: "driver", check: "webdriver" },
    { a: "--enable-fixed-layout", src: "lcnc", legacy: true },
    { a: "--enable-logging=stderr", src: "driver" },
    { a: "--expose-gc", src: "lcnc" },
    { a: "--force-color-profile=srgb", src: "lcnc", check: "gamut" },
    { a: "--ignore-certificate-errors", src: "lcnc", note: "verify on demand with the cert probe below (external badssl.com)" },
    { a: "--js-flags=--expose-gc", src: "lcnc", check: "gc" },
    { a: "--lcnc-chrome-instance", src: "lcnc", note: "intentional unknown switch — tags LCNC-owned Chrome processes for cleanup (killStaleChromeBrowser)" },
    { a: "--lcnc-chrome-instance-id=<uuid>", src: "run", note: "uuidv4 per launch (lcaBrowserContext.js)" },
    { a: "--load-extension=<app>/Contents/Resources/lcnc-extension", src: "run", check: "extension" },
    { a: "--log-level=0", src: "driver" },
    { a: "--metrics-recording-only", src: "lcnc" },
    { a: "--no-default-browser-check", src: "lcnc" },
    { a: "--no-first-run", src: "lcnc" },
    { a: "--no-sandbox", src: "lcnc" },
    { a: "--no-service-autorun", src: "driver" },
    { a: "--noerrdialogs", src: "lcnc" },
    { a: "--password-store=basic", src: "driver" },
    { a: "--reduce-security-for-testing", src: "lcnc", legacy: true },
    { a: "--remote-debugging-port=9222", src: "lcnc" },
    { a: "--silent-debugger-extension-api", src: "lcnc" },
    { a: "--test-type", src: "lcnc" },
    { a: "--use-mock-keychain", src: "driver" },
    { a: "--user-data-dir=<tmp>/org.chromium.Chromium.scoped_dir…", src: "run", note: "chromedriver-created temp profile — LCNC passes no --user-data-dir; prefs land in its Default/Preferences" },
    { a: "--flag-switches-begin --flag-switches-end", src: "driver" },
    { a: "data:,", src: "driver", note: "initial URL, not a switch" },
    { a: "prefs: clipboard = 1 (+ content-settings exception) · autofill off · PDF external download", src: "lcnc", note: "NightwatchCapabilities default prefs — no command-line footprint, written into the temp profile's Default/Preferences by chromedriver" }
  ];

  // Live agentic (cloud) launch — constructed from preCreateSeleniumSession.buildAgenticChromeOptions:
  // canonical DEFAULT_ARGS minus --remote-debugging-port, plus AGENT_EXTRA_ARGS, all disable-features
  // merged into ONE switch (Chrome last-wins), plus default prefs. BS/chromedriver add infra defaults.
  var CLOUD_ARGS = [
    { a: "--disable-features=CookieDeprecationFacilitatedTesting,TrackingProtection3pcd,WebPayments,DisableLoadExtensionCommandLineSwitch,PasswordLeakDetection,PasswordCheck,AutofillServerCommunication,SafetyCheck,Translate,InterestFeedContentSuggestions,PasswordManagerOnboarding", src: "lcnc", note: "single Set-deduped switch — merged precisely because Chrome takes the LAST --disable-features" },
    { a: "--disable-blink-features=FileHandling,…,FileSystemObserverUnobserve", src: "lcnc", check: "fsaccess", note: "same 11-feature list as desktop" },
    { a: "--autoplay-policy=no-user-gesture-required", src: "lcnc", check: "autoplay" },
    { a: "--disable-notifications", src: "lcnc", check: "notifications" },
    { a: "--force-color-profile=srgb", src: "lcnc", check: "gamut" },
    { a: "--ignore-certificate-errors", src: "lcnc" },
    { a: "--expose-gc / --js-flags=--expose-gc", src: "lcnc", check: "gc" },
    { a: "--test-type · --no-sandbox · --disable-dev-shm-usage · --disable-popup-blocking · --disable-sync · --disable-hang-monitor · --disable-infobars · … (rest of canonical DEFAULT_ARGS)", src: "lcnc", note: "minus --remote-debugging-port (excluded: BS owns the CDP channel)" },
    { a: "--disable-save-password-bubble · --disable-default-apps · --disable-translate", src: "lcnc", note: "AGENT_EXTRA_ARGS, deduped" },
    { a: "--lcnc-chrome-instance", src: "lcnc" },
    { a: "prefs: clipboard=1 (+ exceptions) · autofill off · PDF external download · password-manager kill switches", src: "lcnc", note: "goog:chromeOptions.prefs — chromedriver writes them into the profile. Clipboard is ALLOWED by default on this path" },
    { a: "(+ chromedriver/BrowserStack infra defaults — --enable-automation etc.)", src: "driver", check: "webdriver" }
  ];

  var BASELINES = {
    desktop: {
      label: "Desktop app (local recorder)",
      sub: "chrome://version of an LCNC-launched local Chrome · lcnc-app/chromeDefaultArgs.js + chromedriver defaults",
      args: DESKTOP_ARGS
    },
    cloud: {
      label: "Cloud agentic (Automate VM)",
      sub: "constructed from lcnc-services preCreateSeleniumSession.buildAgenticChromeOptions — the live Explore-URL / agentic path",
      args: CLOUD_ARGS
    }
  };

  /* ---------------- the 8 user flags → args/prefs they add ---------------- */
  // Mirrors lcnc-backend/lib/tasks/browser_flags.json (chrome metadata). BrowserFlagsHandler
  // dedupes shared args between flags (fake-ui/fake-device appear once even with both media
  // flags on) — mirrored here via the contributor map.
  var FLAG_ARGS = {
    autoselect: { name: "Auto select screen share", args: ["--auto-select-desktop-capture-source=Entire Screen", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"], prefs: [] },
    camera: { name: "Camera & microphone", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"], prefs: [] },
    location: { name: "Location access", args: [], prefs: ["profile.default_content_setting_values.geolocation = 1"] },
    clipboard: { name: "Clipboard access", args: [], prefs: ["profile.default_content_setting_values.clipboard = 1"] },
    incognito: { name: "Incognito mode", args: ["--incognito"], prefs: [] },
    blockall: { name: "Block all permissions", args: ["--deny-permission-prompts"], prefs: ["profile.default_content_setting_values.geolocation = 2"] },
    dark: { name: "Dark mode", args: ["--enable-features=WebContentsForceDark"], prefs: [] },
    language: { name: "Browser language", args: [], prefs: [] } // filled dynamically with the detected locale
  };

  var PARAMS = new URLSearchParams(location.search);
  var activeBaseline = PARAMS.get("baseline") === "cloud" ? "cloud" : "desktop";
  var fpResults = {};
  var lastSnap = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function byId(id) { return document.getElementById(id); }

  /* ---------------- fingerprint rendering ---------------- */
  function runFingerprint() {
    var grid = byId("fpgrid");
    if (!grid) return;
    grid.textContent = "";
    var strongTotal = 0, strongPass = 0;
    Object.keys(CHECKS).forEach(function (id) {
      var c = CHECKS[id];
      var r = c.run();
      fpResults[id] = { pass: r.pass, detail: r.detail, label: c.label };
      if (c.kind === "strong") { strongTotal++; if (r.pass === true) strongPass++; }
      var cell = el("div", "fp");
      cell.setAttribute("data-state", r.pass === true ? "healthy" : r.pass === false ? "gone" : "drift");
      cell.setAttribute("data-fp", id);
      cell.appendChild(el("i", "fp__dot"));
      var body = el("div");
      var k = el("span", "fp__k", c.label + (c.kind === "heuristic" ? " (heuristic)" : c.kind === "info" ? " (info)" : ""));
      body.appendChild(k);
      body.appendChild(el("code", "fp__arg", c.arg));
      body.appendChild(el("span", "fp__v", r.detail));
      cell.appendChild(body);
      grid.appendChild(cell);
    });

    // on-demand probes
    grid.appendChild(buildPopupCheck());
    grid.appendChild(buildCertCheck());

    var m = byId("m-fp");
    if (m) {
      m.textContent = strongPass + "/" + strongTotal;
      m.setAttribute("data-state", strongPass === strongTotal ? "healthy" : strongPass === 0 ? "gone" : "drift");
    }
    var banner = byId("notLcnc");
    if (banner) banner.hidden = strongPass >= 2; // 2+ strong matches ≈ LCNC-launched
  }

  function buildPopupCheck() {
    var cell = el("div", "fp");
    cell.setAttribute("data-state", "config"); // pending — config = not yet evaluated
    cell.setAttribute("data-fp", "popup");
    cell.appendChild(el("i", "fp__dot"));
    var body = el("div");
    body.appendChild(el("span", "fp__k", "Popup blocking disabled (on demand)"));
    body.appendChild(el("code", "fp__arg", "--disable-popup-blocking"));
    var v = el("span", "fp__v", "fires 6s after click so the window.open call has NO user activation — a gesture would defeat the test");
    body.appendChild(v);
    var btn = el("button", null, "Test popup (6s delay)");
    btn.addEventListener("click", function () {
      btn.disabled = true;
      var left = 6;
      var t = setInterval(function () {
        left--;
        btn.textContent = "Opening in " + left + "s…";
        if (left <= 0) {
          clearInterval(t);
          var w = null;
          try { w = window.open("about:blank", "_blank", "width=140,height=90"); } catch (e) { }
          var ok = !!w;
          if (w) { try { w.close(); } catch (e) { } }
          cell.setAttribute("data-state", ok ? "healthy" : "gone");
          v.textContent = ok ? "window.open with no gesture returned a window — popup blocking is disabled"
            : "window.open with no gesture was blocked — popup blocking active";
          fpResults.popup = { pass: ok, detail: v.textContent, label: "Popup blocking disabled" };
          btn.textContent = "Test again";
          btn.disabled = false;
          updateSnap();
        }
      }, 1000);
    });
    body.appendChild(btn);
    cell.appendChild(body);
    return cell;
  }

  function buildCertCheck() {
    var cell = el("div", "fp");
    cell.setAttribute("data-state", "config"); // pending — config = not yet evaluated
    cell.setAttribute("data-fp", "cert");
    cell.appendChild(el("i", "fp__dot"));
    var body = el("div");
    body.appendChild(el("span", "fp__k", "Certificate errors ignored (on demand · external)"));
    body.appendChild(el("code", "fp__arg", "--ignore-certificate-errors"));
    var v = el("span", "fp__v", "fetches https://self-signed.badssl.com — resolves only if cert errors are bypassed. External call, click to run");
    body.appendChild(v);
    var btn = el("button", null, "Test cert bypass");
    btn.addEventListener("click", async function () {
      btn.disabled = true; btn.textContent = "Testing…";
      var ok = null, msg;
      try {
        var opts = { mode: "no-cors", cache: "no-store" };
        if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) opts.signal = AbortSignal.timeout(6000);
        await fetch("https://self-signed.badssl.com/", opts);
        ok = true; msg = "fetch to a self-signed host resolved — certificate errors are ignored";
      } catch (e) {
        ok = false; msg = "fetch failed (" + e.name + ") — cert validation active, or the host is unreachable";
      }
      cell.setAttribute("data-state", ok ? "healthy" : "drift");
      v.textContent = msg;
      fpResults.cert = { pass: ok, detail: msg, label: "Certificate errors ignored" };
      btn.textContent = "Test again"; btn.disabled = false;
      updateSnap();
    });
    body.appendChild(btn);
    cell.appendChild(body);
    return cell;
  }

  /* ---------------- baseline command-line rendering ---------------- */
  var SRC_NOTE = { lcnc: "LCNC", driver: "chromedriver", run: "per-run" };

  function renderBaseline() {
    var box = byId("cmdline");
    if (!box) return;
    box.textContent = "";
    var b = BASELINES[activeBaseline];
    byId("blSub").textContent = b.sub;

    var head = el("div", "cl-row cl-row--head");
    head.appendChild(el("span", "g", ""));
    head.appendChild(el("span", "a", activeBaseline === "desktop"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome \\"
      : "chrome (BrowserStack Automate VM) \\"));
    head.appendChild(el("span", "n", ""));
    box.appendChild(head);

    var foldable = 0;
    b.args.forEach(function (item) {
      var verified = item.check && fpResults[item.check];
      var glyph = " ", cls = "cl-row", note = item.note || "";
      if (verified) {
        if (verified.pass === true) { glyph = "✓"; cls += " cl-row--ok"; note = (note ? note + " · " : "") + verified.detail; }
        else if (verified.pass === false) { glyph = "✗"; cls += " cl-row--bad"; note = (note ? note + " · " : "") + verified.detail; }
        else { glyph = "·"; note = (note ? note + " · " : "") + verified.detail; }
      } else if (item.src === "run") { glyph = "~"; cls += " cl-row--var"; }
      else if (item.legacy) { glyph = "·"; note = (note ? note + " · " : "") + "legacy switch — current Chrome ignores it"; }

      var interesting = verified || item.legacy || item.note || item.src === "run";
      var row = el("div", cls);
      if (!interesting) { row.setAttribute("data-foldable", "1"); foldable++; }
      row.appendChild(el("span", "g", glyph));
      row.appendChild(el("span", "a", item.a));
      row.appendChild(el("span", "n", (note ? note + " · " : "") + SRC_NOTE[item.src]));
      box.appendChild(row);
    });

    if (foldable > 0) {
      var fold = el("div", "cl-row cl-row--fold");
      fold.setAttribute("role", "button");
      fold.setAttribute("tabindex", "0");
      fold.setAttribute("aria-expanded", "false");
      fold.setAttribute("aria-controls", "cmdline");
      var foldA = el("span", "a", "⋯ " + foldable + " more default switches (no page-visible effect) — click to expand");
      fold.appendChild(el("span", "g", "±"));
      fold.appendChild(foldA);
      fold.appendChild(el("span", "n", ""));
      var toggle = function () {
        var folded = box.classList.toggle("cmdline--folded");
        fold.setAttribute("aria-expanded", String(!folded));
        foldA.textContent = folded
          ? "⋯ " + foldable + " more default switches (no page-visible effect) — click to expand"
          : "collapse the " + foldable + " unobservable switches";
      };
      fold.addEventListener("click", toggle);
      fold.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      box.appendChild(fold);
      box.classList.add("cmdline--folded");
    }

    box.appendChild(el("div", "cl-sep"));
    renderAdditions();
  }

  /* ---------------- detected additions (the live diff) ---------------- */
  function renderAdditions() {
    var box = byId("cmdline");
    if (!box) return;
    // clear previous additions
    Array.prototype.slice.call(box.querySelectorAll("[data-add]")).forEach(function (n) { n.remove(); });

    var addRow = function (glyph, cls, text, note) {
      var row = el("div", "cl-row " + cls);
      row.setAttribute("data-add", "1");
      row.appendChild(el("span", "g", glyph));
      row.appendChild(el("span", "a", text));
      row.appendChild(el("span", "n", note || ""));
      box.appendChild(row);
      return row;
    };

    var s = lastSnap;
    if (!s) { addRow("…", "", "(waiting for flag detection)", ""); return; }
    var applied = s.flags || {};
    var count = 0, inferred = 0;

    // args, deduped across flags like BrowserFlagsHandler.addOrOverrideArg does
    var argMap = {}; // arg -> {names:[], kind}
    var claim = function (flagKey, kind) {
      FLAG_ARGS[flagKey].args.forEach(function (a) {
        if (!argMap[a]) argMap[a] = { names: [], kind: kind };
        argMap[a].names.push(FLAG_ARGS[flagKey].name);
        if (kind === "add") argMap[a].kind = "add"; // strong claim wins
      });
    };

    if (applied["Camera & microphone"] === true) claim("camera", s.cameraFakeDevice ? "add" : "inf");
    if (applied["Auto select screen share"] === true) claim("autoselect", "add");
    if (applied["Dark mode"] === true) claim("dark", "add");
    else if (s.dark && s.dark.prefersColorScheme === "dark") claim("dark", "inf");
    if (applied["Block all permissions (heuristic)"] === true) claim("blockall", "inf");

    Object.keys(argMap).sort().forEach(function (a) {
      var m = argMap[a];
      var strong = m.kind === "add";
      addRow(strong ? "+" : "±", strong ? "cl-row--add" : "cl-row--inf", a,
        "← " + m.names.join(" + ") + (strong ? " (detected)" : " (inferred — verify)"));
      if (strong) count++; else inferred++;
    });

    // language — only claim a "+" when the locale genuinely maps to a non-default LCNC preset.
    // en-* base matches fall back to the en-US preset (en-IN, en-AU…), which is NOT evidence the
    // flag was set; locales outside the 11 presets (pt-BR…) can't have come from the flag at all.
    var lang = s.language || {};
    var primary = lang.primary || "";
    var FI = window.FlagInspector;
    var m = primary && FI && FI.matchPreset ? FI.matchPreset(primary) : null;
    if (m && m.preset.value !== "en-US") {
      addRow("+", "cl-row--add", "--lang=" + m.preset.value,
        "← Browser language (navigator.language = " + primary +
        (m.kind === "base" ? " — Chrome normalized " + m.preset.value + " → " + primary : "") + ")");
      addRow("·", "cl-row--pref", "pref intl.accept_languages = " + m.preset.value,
        "no command-line footprint — rides in goog:chromeOptions.prefs");
      count++;
    } else if (m && m.preset.value === "en-US") {
      addRow("·", "", "(--lang not inferable: " + primary + " — the en-US default preset is indistinguishable from unset)", "");
    } else {
      addRow("·", "", "(--lang not inferable: " + (primary || "unknown") + " is not one of the 11 LCNC presets — the flag can't have set it)", "");
    }

    // pref-only flags
    if (applied["Location access"] === true) {
      addRow("·", "cl-row--pref", "pref profile.default_content_setting_values.geolocation = 1", "← Location access (granted — pref applied)");
      count++;
    } else if (applied["Location access"] === false) {
      addRow("·", "cl-row--pref", "pref profile.default_content_setting_values.geolocation = 2", "geolocation denied — flag Disabled, Block-all, or the WDIO path's forced deny");
    }
    if (applied["Clipboard access"] === false) {
      addRow("·", "cl-row--pref", "pref profile.default_content_setting_values.clipboard = 2", "← Clipboard access Disabled (default on agentic/desktop paths is allow)");
      count++;
    } else if (applied["Clipboard access"] === true) {
      addRow("·", "", "(clipboard allowed — LCNC defaults already set clipboard = 1, so 'Enabled' is indistinguishable from default)", "");
    }

    // incognito — no JS signal on modern Chrome
    if (s.incognito && s.incognito.chromeMajor != null && s.incognito.chromeMajor >= 133) {
      addRow("·", "", "(--incognito not inferable: Chrome " + s.incognito.chromeMajor + " hardcodes storage quota in both modes — verify via run UI/video)", "");
    } else if (applied["Incognito mode (heuristic)"] === true) {
      addRow("±", "cl-row--inf", "--incognito", "← Incognito mode (quota heuristic — verify)");
      inferred++;
    }

    var mAdd = byId("m-add");
    if (mAdd) {
      mAdd.textContent = count + (inferred ? "+" + inferred : "");
      mAdd.setAttribute("data-state", count > 0 ? "healthy" : inferred > 0 ? "drift" : "config");
    }
    updateSnap();
  }

  /* ---------------- machine snapshot ---------------- */
  function updateSnap() {
    var pre = byId("diffSnap");
    if (!pre) return;
    pre.textContent = JSON.stringify({
      generatedAt: new Date().toISOString(),
      url: location.href,
      baseline: activeBaseline,
      fingerprint: fpResults,
      flagDetection: lastSnap ? { flags: lastSnap.flags, verdicts: lastSnap.verdicts, cameraFakeDevice: lastSnap.cameraFakeDevice, language: lastSnap.language } : null
    }, null, 2);
  }

  /* ---------------- wiring ---------------- */
  function init() {
    // baseline switcher
    Array.prototype.forEach.call(document.querySelectorAll("#blSeg button"), function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-bl") === activeBaseline ? "true" : "false");
      btn.addEventListener("click", function () {
        activeBaseline = btn.getAttribute("data-bl");
        Array.prototype.forEach.call(document.querySelectorAll("#blSeg button"), function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        // keep the choice deep-linkable — a copied URL reopens on the same baseline
        try {
          var u = new URL(location.href);
          u.searchParams.set("baseline", activeBaseline);
          history.replaceState(null, "", u);
        } catch (e) { }
        renderBaseline();
      });
    });

    runFingerprint();
    renderBaseline();

    // extension content scripts can inject late — rescan a few times
    var scans = 0;
    var t = setInterval(function () {
      scans++;
      var r = CHECKS.extension.run();
      var flipped = r.pass === true && (!fpResults.extension || fpResults.extension.pass !== true);
      fpResults.extension = { pass: r.pass, detail: r.detail, label: CHECKS.extension.label };
      var cell = document.querySelector('[data-fp="extension"]');
      if (cell) {
        cell.setAttribute("data-state", r.pass === true ? "healthy" : "drift");
        var v = cell.querySelector(".fp__v"); if (v) v.textContent = r.detail;
      }
      // refresh the --load-extension row's ✓ annotation too — but never yank keyboard
      // focus: rebuilding #cmdline while the user is on the fold row would drop it to <body>
      if (flipped && !byId("cmdline").contains(document.activeElement)) renderBaseline();
      if (r.pass === true || scans >= 4) { clearInterval(t); updateSnap(); }
    }, 2000);

    document.addEventListener("flags:updated", function (e) {
      lastSnap = e.detail;
      renderAdditions();
    });
    if (window.FlagInspector) { lastSnap = window.FlagInspector.snapshot(); renderAdditions(); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
