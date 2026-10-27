#!/usr/bin/env bash
# Deploy the site from this computer over encrypted FTP.
# Backup for when the GitHub Actions deploy is blocked. Uploads the last
# commit (not uncommitted edits) to public_html, with the same CSS/JS
# cache-busting as the GitHub deploy. It never deletes anything on the server.
#
#   bash .github/deploy-ftp.sh
set -euo pipefail

SERVER="ftp.aafaq.com.pk"     # FTP server from cPanel
HOST="shared.bestnodes.com"   # name on that server's TLS certificate, used to verify the connection
DEFAULT_USER="ali@aafaq.com.pk"
DEFAULT_DIR="public_html"

cd "$(git rev-parse --show-toplevel)"
if ! git diff --quiet HEAD; then
  echo "Note: you have uncommitted changes. Only the last commit is deployed."
fi

read -r -p "FTP username [$DEFAULT_USER]: " user
user="${user:-$DEFAULT_USER}"
read -r -s -p "FTP password: " pass
echo

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
chmod 700 "$work"

# Keep the password out of the process list by giving it to curl in a file.
printf 'machine %s login %s password %s\n' "$HOST" "$user" "$pass" > "$work/netrc"
chmod 600 "$work/netrc"
unset pass

ftp() {
  curl -sS --ssl-reqd --netrc-file "$work/netrc" --connect-timeout 20 \
    --connect-to "$HOST:21:$SERVER:21" "$@"
}

echo "Connecting to $SERVER as $user..."
if ! listing="$(ftp --list-only "ftp://$HOST/")"; then
  echo "Could not log in. Check the username and password."
  exit 1
fi
echo "Folders in your FTP home: $(echo "$listing" | tr '\n' ' ')"

read -r -p "Folder that holds the website [$DEFAULT_DIR]: " dir
dir="${dir:-$DEFAULT_DIR}"
dir="${dir%/}"
if [ "$dir" = "." ] || [ -z "$dir" ]; then base="ftp://$HOST/"; else base="ftp://$HOST/$dir/"; fi

if ! ftp --list-only "$base" | grep -qx "index.html"; then
  echo "No index.html in '$dir'. That does not look like the live site; stopping."
  exit 1
fi

# Build the files to upload from the last commit.
sha="$(git rev-parse --short=8 HEAD)"
mkdir "$work/site"
git archive HEAD | tar -x -C "$work/site"
rm -rf "$work/site/.github" "$work/site/README.md" "$work/site/VERSION" "$work/site/.gitignore"
sed -i "s/?v=dev/?v=${sha}/g" "$work/site"/*.html

echo "Deploying commit $sha to $dir/ ..."
count=0
while IFS= read -r -d '' file; do
  rel="${file#"$work/site/"}"
  ftp --ftp-create-dirs -T "$file" "$base$rel"
  echo "  uploaded $rel"
  count=$((count + 1))
done < <(find "$work/site" -type f -print0)

echo "Done: $count files uploaded. Check https://aafaq.com.pk/"
