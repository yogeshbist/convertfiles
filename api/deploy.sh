#!/bin/zsh
# One-time deploy of the analytics/admin API to Cloudflare Workers (free tier).
#   1. wrangler login            (opens the browser once)
#   2. ./deploy.sh               (creates the D1 database, applies the schema, deploys)
#   3. wrangler secret put ADMIN_PASSWORD      (type the admin password)
#      wrangler secret put GITHUB_TOKEN        (paste a fine-grained PAT: repo convertfiles, Contents: read & write)
#      wrangler secret put TOKEN_SECRET        (any long random string)
#   4. put the printed URL into site.json -> api_base, run build.py, commit, push
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"
W=./node_modules/.bin/wrangler
if grep -q "00000000-0000-0000-0000-000000000000\|REPLACE_AFTER_D1_CREATE" wrangler.toml; then
  echo "creating the D1 database…"
  OUT=$($W d1 create convertfiles 2>&1) || true
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [ -z "$ID" ]; then
    ID=$($W d1 list --json 2>/dev/null | python3 -c "import sys,json; print(next((d['uuid'] for d in json.load(sys.stdin) if d['name']=='convertfiles'),''))")
  fi
  [ -z "$ID" ] && { echo "could not create or find the D1 database:"; echo "$OUT"; exit 1; }
  sed -i '' "s/00000000-0000-0000-0000-000000000000/$ID/; s/REPLACE_AFTER_D1_CREATE/$ID/" wrangler.toml
  echo "database id: $ID"
fi
echo "applying the schema…"
$W d1 execute convertfiles --remote --file schema.sql >/dev/null
echo "deploying…"
$W deploy 2>&1 | tee /tmp/cf-deploy.log | tail -4
URL=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' /tmp/cf-deploy.log | head -1)
echo
echo "API URL: $URL"
echo "next: set the three secrets (see the top of this file), then put the URL into site.json as api_base."
