# LCA Self-Healing Playground

Controllable pages to test LCA agentic self-healing. **Same URL the whole time** — the break is driven by a shared flag, so the agentic test never re-records from scratch.

## Toggle the break (no URL change)
- **Button:** repo > Actions > **toggle-heal** > Run workflow > pick `on` / `off` / `gone`.
- **CLI:** `./toggle.sh on` / `./toggle.sh off` / `./toggle.sh gone`.
- Pages reflect the change in ~30-60s. Then re-run the SAME saved agentic test URL: `on` => the captured locator is broken => heal fires; `off` => healthy; `gone` => the checkout action is removed entirely => heals fail until the budget exhausts (unhealable).

Resolution order in `flag.js`: `?v=2`/`?break`/`?gone` (manual, per-tab) > `localStorage.lcaBreak=1` (same browser) > `flag.json` (shared). `?gone=0`/`?break=false` count as off.

## Pages
checkout.html (Checkout drift + decoy; `gone` removes it), frames.html (iframe+shadow), validation.html (`#status-badge` drift; `?remove=1`/`?wrong=1`), visual.html, timing.html (`?delay`), flow.html (mid-step drift), modal.html (random promo popup interrupts mid-flow; close-and-continue, blocked clicks logged; `?popup=1` forces / `?popup=0` suppresses), data.html (`#token`; `?use=`), email.html (verify link/OTP), cookie.html, config.html (run-config inspector: injected headers, cookies, localStorage, basic-auth probe + egress IP/country for the IP-geolocation toggle), download.html (report.txt fixture in `files/`), upload.html (native OS file dialog; expects report.txt back), api.html (renders api/todo.json live + external httpbin failure legs). index.html has the 34-case map; 404.html catches dead URLs.

## Browser-flag inspector
`flags/index.html` — reads the launched Chrome and reports which of the 8 Advanced-Configuration **browser flags** (auto screen-share, camera/mic, location, clipboard, incognito, block-all, dark mode, language) actually took effect. Point the Automate-with-AI **Explore URL** flow at this URL to verify a run's flags end to end; readouts are live DOM text + a machine-readable snapshot the agent can assert on. `flags/language.html` is the language deep-dive (localized content across all 11 presets, active row highlighted).

Confidence is marked per flag: **strong** (definitive JS signal) vs **heuristic** (incognito quota-gap, dark-mode screenshot swatch — verify by comparing on/off). Incognito on Chrome 133+: quota reports `min(real, usage + 10 GiB)` — a normal profile reads *exactly* usage + 10 GiB while incognito's RAM-derived cap (≈1–4 GiB) shows through, so the gap is the signal; it also catches the #1946 regression where the MCP page swap's `newPage()` dropped an `--incognito` session's agent tab into the normal profile.

The launch path matters: the **live agentic path** (`preCreateSeleniumSession` → `BrowserFlagsHandler`) applies flag **args and prefs**, dedupes repeats, and its defaults already allow clipboard (pref = 1) — so Clipboard *Enabled* is indistinguishable from default, is **not** counted toward the active-toggles metric (a zero-flag control run reads 0 / 7), and only *Disabled* is observable. Since lcnc-services **#1946** + lcnc-backend **#4486**, the **validation replay** and **Argus cached-run** paths route through the same canonical handler + agent overlay (args **and** prefs), the locale finally applies on the live agent session (`intl.accept_languages`), and group-level popup-suppression defaults are overridable fallbacks — the user's catalog choice wins. **All run types should now read identically on these pages; a per-run-type mismatch is the regression signal.** (Pre-fix: the replay paths dropped user flags entirely and force-denied geolocation/camera/mic; the older **pwCaps path** appended a 7-flag hand-picked subset, args only.)

`flags/diff.html` — **launch diff**: renders the default LCNC Chrome command line (desktop-app or cloud-agentic baseline), verifies the baseline's JS-observable fingerprints (`navigator.webdriver`, `window.gc`, File-System-Access APIs stripped, autoplay policy…), and overlays the extra args/prefs inferred live from the 8 user flags — so you can *see* what a run added on top of the defaults. Probes auto-run when permission states are pre-decided (agentic runs), so it self-populates with zero clicks; `?noauto=1` disables.
