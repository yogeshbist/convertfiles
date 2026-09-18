#!/bin/zsh
# Sets the two secrets only you should know. Run this once in your own terminal:
#   ./set-secrets.sh
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"
echo "1/2  Choose the admin password (used by convertfiles.in/admin and the Android app)."
./node_modules/.bin/wrangler secret put ADMIN_PASSWORD
echo
echo "2/2  Paste a GitHub token so the admin panel can publish content edits."
echo "     Create it at https://github.com/settings/personal-access-tokens/new"
echo "     Repository access: Only select repositories -> convertfiles"
echo "     Permissions: Contents -> Read and write.   Generate, copy, paste below."
./node_modules/.bin/wrangler secret put GITHUB_TOKEN
echo
echo "done — sign in at https://convertfiles.in/admin"
