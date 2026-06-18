#!/usr/bin/env bash
# Toggle the shared heal break flag. Usage: ./toggle.sh on|off|gone
set -e
S="${1:-on}"
case "$S" in
  on)   echo '{"break": true}'   > flag.json;;
  off)  echo '{"break": false}'  > flag.json;;
  gone) echo '{"break": "gone"}' > flag.json;;
  *) echo "usage: ./toggle.sh on|off|gone"; exit 1;;
esac
git add flag.json && git commit -m "toggle heal break -> $S" && git push
echo "flag set to $S; GitHub Pages reflects it in ~30-60s."
