# LCA Self-Healing Playground

Controllable pages to test LCA agentic self-healing. **Same URL the whole time** — the break is driven by a shared flag, so the agentic test never re-records from scratch.

## Toggle the break (no URL change)
- **Button:** repo > Actions > **toggle-heal** > Run workflow > pick `on` / `off`.
- **CLI:** `./toggle.sh on` / `./toggle.sh off`.
- Pages reflects the change in ~30-60s. Then re-run the SAME saved agentic test URL: `on` => the captured locator is broken => heal fires; `off` => healthy.

Resolution order in `flag.js`: `?v=2`/`?break` (manual) > `localStorage.lcaBreak=1` (same browser) > `flag.json` (shared).

## Pages
checkout.html (Checkout drift + decoy; `?gone=1` removes it), frames.html (iframe+shadow), validation.html (`#status-badge` drift; `?remove`/`?wrong`), visual.html, timing.html (`?delay`), flow.html (mid-step drift), data.html (`#token`; `?use=`), email.html (verify link/OTP), cookie.html, download.html, api/todo.json. index.html has the 34-case map.
