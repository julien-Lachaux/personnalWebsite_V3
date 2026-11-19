#!/usr/bin/env bash
# Tests de scripts/ci/check-tests-integrity.sh : chaque cas crée un dépôt git temporaire avec une
# branche d'intégration « v3/backend », dérive une branche, applique un scénario et vérifie le code
# de sortie du script. Lancé par `pnpm integrity:test` (donc par pnpm check) et par la CI.
#
# Les marqueurs sont construits à l'exécution : ce fichier n'en contient aucun littéralement.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-tests-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

SKIP_MARKER="it.$(printf '%s' sk)ip('saute', () => {});"
FAILS_MARKER="it.$(printf '%s' fa)ils('BUG-1 attendu', () => {});"
IGNORE_COMMENT="/* $(printf '%s' v8) $(printf '%s' ignore) next */"

passed=0
failed=0
repo=""

new_repo() {
  repo="$WORK/$1"
  mkdir -p "$repo"
  cd "$repo"
  git init -q -b v3/backend
  git config user.name 'Test'
  git config user.email 'ci@noreply.invalid'
  git config commit.gpgsign false
  mkdir -p apps/api/src apps/api/test/support
  printf "it('e2e', () => {});\n" >apps/api/test/a.e2e-spec.ts
  printf "it('b', () => {});\n" >apps/api/test/b.e2e-spec.ts
  printf 'export const reset = () => undefined;\n' >apps/api/test/support/db.ts
  printf 'export const answer = 42;\n' >apps/api/src/app.ts
  printf 'export default { test: { coverage: { thresholds: { lines: 100 } } } };\n' >apps/api/vitest.config.ts
  printf '{\n  "scripts": {\n    "test": "vitest run",\n    "build": "tsc"\n  }\n}\n' >package.json
  git add -A
  git commit -q -m 'base'
  git checkout -q -b lot/essai
}

commit() {
  git add -A
  git commit -q -m "$1"
}

expect() {
  local expected="$1" name="$2" code=0
  bash "$SCRIPT" v3/backend >"$WORK/out.txt" 2>&1 || code=$?
  if [ "$code" -eq "$expected" ]; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (code %s, attendu %s)\n' "$name" "$code" "$expected"
    sed 's/^/        /' "$WORK/out.txt"
  fi
}

# Branche saine : nouveau test et code modifié.
new_repo sain
printf "it('nouveau', () => {});\n" >apps/api/test/c.e2e-spec.ts
printf 'export const answer = 43;\n' >apps/api/src/app.ts
commit 'feat: nouvelle route'
expect 0 'branche saine (nouveau test, code modifié)'

new_repo suppression
git rm -q apps/api/test/a.e2e-spec.ts
commit 'test: retire un test'
expect 1 'test supprimé sans justification'

new_repo suppression-justifiee
git rm -q apps/api/test/a.e2e-spec.ts
commit "$(printf 'test: retire un test faux\n\nJustification-test: RC-9 le test vérifiait un comportement retiré de docs/01')"
expect 0 'test supprimé avec justification'

new_repo modification
printf "it('e2e', () => { /* vidé */ });\n" >apps/api/test/a.e2e-spec.ts
commit 'test: assouplit'
expect 1 'test modifié sans justification'

new_repo justification-ailleurs
printf "it('e2e', () => { /* vidé */ });\n" >apps/api/test/a.e2e-spec.ts
commit 'test: assouplit'
printf 'export const answer = 1;\n' >apps/api/src/app.ts
commit "$(printf 'fix: autre\n\nJustification-test: RC-1 sans rapport')"
expect 1 'justification portée par un commit qui ne touche pas le test'

new_repo support
printf 'export const reset = () => 1;\n' >apps/api/test/support/db.ts
commit 'test: support'
expect 1 'fichier de test/support modifié sans justification'

new_repo saut
printf '%s\n' "$SKIP_MARKER" >apps/api/test/c.e2e-spec.ts
commit 'test: nouveau'
expect 1 'marqueur de saut dans un nouveau test'

new_repo saut-non-suivi
printf '%s\n' "$SKIP_MARKER" >apps/api/src/brouillon.spec.ts
expect 1 'marqueur de saut dans un fichier non suivi'

new_repo saut-enchaine
printf 'describe.%s.each([1])("cas %%s", () => {});\n' "$(printf '%s' sk)ip" >apps/api/test/d.e2e-spec.ts
commit 'test: nouveau'
expect 1 'marqueur de saut enchaîné (each)'

new_repo citation
printf 'Le test BUG-1 était un it.%s : retiré au lot suivant.\n' "$(printf '%s' fa)ils" >NOTES.md
commit 'docs: notes'
expect 0 'marqueur cité en prose sans parenthèse'

new_repo ignore
printf '%s\nexport const x = 1;\n' "$IGNORE_COMMENT" >apps/api/src/x.ts
commit 'feat: x'
expect 1 "commentaire d'ignore de couverture"

new_repo echec-attendu
printf '%s\n' "$FAILS_MARKER" >apps/api/test/bug.e2e-spec.ts
commit 'test: BUG-1'
expect 1 'test en échec attendu sans justification'

new_repo echec-attendu-justifie
printf '%s\n' "$FAILS_MARKER" >apps/api/test/bug.e2e-spec.ts
commit "$(printf 'test: BUG-1\n\nJustification-test: BUG-1 défaut trouvé en qa, corrigé au lot suivant')"
expect 0 'test en échec attendu avec justification'

new_repo couverture
sed -i 's/lines: 100/lines: 90/' apps/api/vitest.config.ts
commit 'chore: seuil'
expect 1 'configuration de couverture modifiée sans justification'

new_repo couverture-justifiee
sed -i 's/lines: 100/lines: 100, branches: 100/' apps/api/vitest.config.ts
commit "$(printf 'chore: seuil des branches\n\nJustification-test: L9-01 seuil branches explicite')"
expect 0 'configuration de couverture modifiée avec justification'

new_repo workflow
mkdir -p .github/workflows
printf 'on: push\n' >.github/workflows/ci.yml
commit 'ci: nouveau'
expect 1 'workflow de CI ajouté sans justification'

new_repo script-de-test
sed -i 's/"vitest run"/"vitest run --passWithNoTests"/' package.json
commit 'chore: test'
expect 1 'script de test du package.json modifié sans justification'

new_repo script-de-build
sed -i 's/"tsc"/"tsc -p tsconfig.build.json"/' package.json
commit 'chore: build'
expect 0 'script de build du package.json modifié (non protégé)'

new_repo base-absente
expect_missing_base() {
  local code=0
  bash "$SCRIPT" origine/inexistante >/dev/null 2>&1 || code=$?
  if [ "$code" -eq 2 ]; then
    passed=$((passed + 1))
    printf 'ok      %s\n' 'base introuvable : code 2'
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   base introuvable (code %s, attendu 2)\n' "$code"
  fi
}
expect_missing_base

printf '\n%s réussi(s), %s échoué(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
