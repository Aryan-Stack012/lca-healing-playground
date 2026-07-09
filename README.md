# LCA Self-Healing Playground

Controllable pages to test LCA agentic self-healing. **Same URL the whole time** — the break is driven by a shared flag, so the agentic test never re-records from scratch.

## Toggle the break (no URL change)
- **Button:** repo > Actions > **toggle-heal** > Run workflow > pick `on` / `off`.
- **CLI:** `./toggle.sh on` / `./toggle.sh off`.
- Pages reflects the change in ~30-60s. Then re-run the SAME saved agentic test URL: `on` => the captured locator is broken => heal fires; `off` => healthy.

Resolution order in `flag.js`: `?v=2`/`?break` (manual) > `localStorage.lcaBreak=1` (same browser) > `flag.json` (shared).

## Pages
checkout.html (Checkout drift + decoy; `?gone=1` removes it), frames.html (iframe+shadow), validation.html (`#status-badge` drift; `?remove`/`?wrong`), visual.html, timing.html (`?delay`), flow.html (mid-step drift), data.html (`#token`; `?use=`), email.html (verify link/OTP), cookie.html, download.html, api/todo.json. index.html has the 34-case map.

## Browser-flag inspector
`flags/index.html` — reads the launched Chrome and reports which of the 8 Advanced-Configuration **browser flags** (auto screen-share, camera/mic, location, clipboard, incognito, block-all, dark mode, language) actually took effect. Point the Automate-with-AI **Explore URL** flow at this URL to verify a run's flags end to end; readouts are live DOM text + a machine-readable snapshot the agent can assert on. `flags/language.html` is the language deep-dive (localized content across all 11 presets, active row highlighted).

Confidence is marked per flag: **strong** (definitive JS signal) vs **heuristic** (incognito quota, dark-mode screenshot swatch — verify by comparing on/off). Caveat this page is designed to expose: the agentic launch path applies flag **args only, not prefs**, and force-adds `--deny-permission-prompts` + a geolocation block on every run — so pref-only flags (Location, Clipboard) can read *blocked* even when enabled, and Block-all can read *on* even when off. (The desktop/replay path via `BrowserFlagsHandler` applies both args **and** prefs, so behavior differs per launch path.)

`flags/diff.html` — **launch diff**: renders the default LCNC Chrome command line (desktop-app or cloud-agentic baseline), verifies the baseline's JS-observable fingerprints (`navigator.webdriver`, `window.gc`, File-System-Access APIs stripped, autoplay policy…), and overlays the extra args/prefs inferred live from the 8 user flags — so you can *see* what a run added on top of the defaults. Probes auto-run when permission states are pre-decided (agentic runs), so it self-populates with zero clicks; `?noauto=1` disables.
