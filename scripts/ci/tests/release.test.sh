#!/usr/bin/env bash
# Tests de scripts/ci/release.mjs (L23) : version suivante, changelog, concordance, étiquetage, dépôts jetables.
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
new_repo() { # nom : dépôt avec package.json et un premier commit
  mkdir "$tmp/$1"
  cd "$tmp/$1"
  git init -q -b develop
  echo '{ "name": "x", "version": "0.0.0" }' >package.json
  git add package.json
  git commit -q -m 'chore: départ'
}
c() { # sujet [corps]
  if [ -n "${2:-}" ]; then git commit -q --allow-empty -m "$1" -m "$2"; else git commit -q --allow-empty -m "$1"; fi
}
rel() { node "$script" "$@"; }
code() { # code de sortie de la commande
  local s=0
  "$@" >/dev/null 2>&1 || s=$?
  echo "$s"
}

# Sans étiquette : version de départ 3.0.0, préparée sur release/3.0.0.
new_repo depart
is 'sans étiquette : next vaut 3.0.0' "$(rel next)" 3.0.0
is 'prepare hors release/<version> refusé (code 1)' "$(code rel prepare)" 1
git switch -q -c release/3.0.0
is 'prepare sur release/3.0.0' "$(rel prepare --commit --trailer 'Co-Authored-By: T <t@example.org>')" 3.0.0
is 'package.json à 3.0.0' "$(grep -c '"version": "3.0.0"' package.json)" 1
is 'CHANGELOG : section 3.0.0 datée' "$(grep -c '^## \[3.0.0\] - 2026-01-02$' CHANGELOG.md)" 1
is 'commit chore(release) créé avec le trailer' "$(git log -1 --format='%s %b' | grep -c -e 'chore(release): 3.0.0' -e 'Co-Authored-By')" 1
is 'check concordant' "$(code rel check release/3.0.0)" 0
is 'check : mauvaise version de branche refusée' "$(code rel check release/3.0.1)" 1
is 'check : branche qui n est pas une release refusée' "$(code rel check lot/23-x)" 1
is 'should-tag : 3.0.0 à étiqueter' "$(rel should-tag)" 3.0.0
is 'notes 3.0.0 commence par le titre' "$(rel notes 3.0.0 | head -1)" '## [3.0.0] - 2026-01-02'
is 'notes sans version : code 2' "$(code rel notes)" 2
is 'notes version inconnue : code 1' "$(code rel notes 9.9.9)" 1
is 'commande inconnue : code 2' "$(code rel nimporte)" 2

# Après l'étiquette : calcul semver selon les types, exclusions, majeure.
git tag v3.0.0
is 'should-tag : déjà étiqueté, rien' "$(rel should-tag)" ''
c 'docs: note'
is 'rien à publier (docs seul) : code 1' "$(code rel next)" 1
c 'test(api): couverture'
c 'fix(api): corrige le tri'
is 'un fix : correctif 3.0.1' "$(rel next)" 3.0.1
c 'perf: requête plus rapide'
is 'un perf : toujours 3.0.1' "$(rel next)" 3.0.1
c 'feat(web): nouvelle page'
is 'un feat : mineure 3.1.0' "$(rel next)" 3.1.0
c 'refactor!: retire une route'
is 'un ! : majeure 4.0.0' "$(rel next)" 4.0.0
git switch -q -c release/4.0.0
rel prepare >/dev/null
is 'section 4.0.0 : quatre rubriques' \
  "$(grep -c -e '^### Changements incompatibles$' -e '^### Nouveautés$' -e '^### Corrections$' -e '^### Performances$' CHANGELOG.md)" 4
is 'docs et test absents du changelog' "$(grep -c -e 'docs: note' -e 'couverture' CHANGELOG.md || true)" 0
is 'la portée est citée en gras' "$(grep -c '^- \*\*web\*\* : nouvelle page' CHANGELOG.md)" 1
is 'la section 3.0.0 reste dessous' "$(grep -c '^## \[' CHANGELOG.md)" 2
is 'section 4.0.0 avant 3.0.0' "$(grep '^## \[' CHANGELOG.md | head -1 | cut -c1-10)" '## [4.0.0]'
rel prepare >/dev/null
is 'prepare rejoué : pas de section en double' "$(grep -c '^## \[4.0.0\]' CHANGELOG.md)" 1
git commit -q -am 'chore(release): 4.0.0'
is 'check concordant après le commit de release' "$(code rel check release/4.0.0)" 0
c 'fix: encore un'
is 'check : commit ajouté sans changer la majeure, concordant' "$(code rel check release/4.0.0)" 0

# BREAKING CHANGE en pied de message, hotfix sans changelog, commits de fusion ignorés.
new_repo pied
git switch -q -c release/3.0.0
rel prepare --commit >/dev/null
git tag v3.0.0
c 'fix: petit' $'Détail.\n\nBREAKING CHANGE: le format change'
is 'BREAKING CHANGE en pied : majeure' "$(rel next)" 4.0.0
git switch -q -c release/4.0.0
rel prepare >/dev/null
is 'la note de rupture figure au changelog' "$(grep -c 'le format change' CHANGELOG.md)" 1
git reset -q --hard v3.0.0
c 'fix: correctif direct sur main'
is 'hotfix sans mise à jour du changelog : pas d étiquette' "$(rel should-tag)" ''
git switch -q -c side v3.0.0
c 'feat: a'
git switch -q release/4.0.0
git merge -q --no-ff side -m 'Merge branch side'
is 'les commits de fusion sont ignorés (fix + feat : 3.1.0)' "$(rel next)" 3.1.0

# Tri semver : 3.10.0 > 3.9.0.
new_repo tri
git tag v3.9.0
git tag v3.10.0
c 'fix: x'
is 'tri semver des étiquettes : 3.10.1' "$(rel next)" 3.10.1
is 'should-tag : version du package.json en retard sur la dernière étiquette, rien' "$(rel should-tag)" ''

exit "$fail"
