#!/usr/bin/env bash
# Tests de scripts/ci/release.mjs (L26-04) : `prepare --commit` refusé sur la branche main, dépôt jetable.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script="$PWD/scripts/ci/release.mjs"
fail=0
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.org GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.org
export GIT_CONFIG_GLOBAL=/dev/null RELEASE_DATE=2026-01-02

is() { # description, obtenu, attendu
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (obtenu « $2 », attendu « $3 »)"; fail=1; fi
}
code() { # code de sortie de la commande
  local s=0
  "$@" >/dev/null 2>&1 || s=$?
  echo "$s"
}
rel() { node "$script" "$@"; }

mkdir "$tmp/repo"
cd "$tmp/repo"
git init -q -b main
echo '{ "name": "x", "version": "0.0.0" }' >package.json
git add package.json
git commit -q -m 'chore: départ'

is 'sur main, prepare --commit refusé (code 1)' "$(code rel prepare --commit)" 1
is 'sur main, prepare --commit --any-branch refusé aussi (code 1)' "$(code rel prepare --commit --any-branch)" 1
is 'le refus ne crée aucun commit' "$(git rev-list --count HEAD)" 1
is 'le refus ne crée pas de CHANGELOG' "$([ -e CHANGELOG.md ] && echo oui || echo non)" non
is 'sur main, prepare --any-branch sans --commit reste permis (hotfix)' "$(rel prepare --any-branch)" 3.0.0
git checkout -q -- package.json
rm -f CHANGELOG.md
git switch -q -c hotfix/3.0.0
is 'sur hotfix/*, prepare --commit --any-branch permis' "$(code rel prepare --commit --any-branch)" 0

exit "$fail"
