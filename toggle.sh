#!/usr/bin/env bash
# Toggle the shared heal break flag. Usage: ./toggle.sh on|off
set -e
S="${1:-on}"
if [ "$S" = "on" ]; then echo '{"break": true}' > flag.json; else echo '{"break": false}' > flag.json; fi
git add flag.json && git commit -m "toggle heal break -> $S" && git push
echo "flag set to $S; GitHub Pages reflects it in ~30-60s (the same test URL then renders the $([ "$S" = on ] && echo broken || echo healthy) variant)."
