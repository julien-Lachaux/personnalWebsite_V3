#!/usr/bin/env bash
# Tests de scripts/ci/check-tests-integrity.sh pour le front (lot F0, F0-06) : parcours Playwright
# `*.e2e.ts`, tests de composants, captures attendues et de référence, configuration Playwright et
# turbo.json de paquet. Même harnais que check-tests-integrity.test.sh : un dépôt git temporaire
# par cas, branche d'intégration « develop », branche dérivée, code de sortie attendu.
# Lancé par `pnpm integrity:test` (donc par pnpm check) et par la CI.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-front-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

REFERENCE='apps/web/design/handoff-v6/design/reference/desktop-1280_mosaique_clair.png'
passed=0
failed=0
repo=""

new_repo() {
  repo="$WORK/$1"
  mkdir -p "$repo"
  cd "$repo"
  git init -q -b develop
  git config user.name 'Test'
  git config user.email 'ci@noreply.invalid'
  git config commit.gpgsign false
  mkdir -p apps/web/app/pages apps/web/test/visual.e2e.ts-snapshots "$(dirname "$REFERENCE")"
  printf '<template><h1>Accueil</h1></template>\n' >apps/web/app/pages/index.vue
  printf "it('h1', () => {});\n" >apps/web/app/pages/index.spec.ts
  printf "test('fumée', async () => {});\n" >apps/web/test/smoke.e2e.ts
  printf 'png attendu\n' >apps/web/test/visual.e2e.ts-snapshots/desktop-1280.png
  printf 'export default { retries: 0 };\n' >apps/web/playwright.config.ts
  printf 'png de référence\n' >"$REFERENCE"
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
  bash "$SCRIPT" develop >"$WORK/out.txt" 2>&1 || code=$?
  if [ "$code" -eq "$expected" ]; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (code %s, attendu %s)\n' "$name" "$code" "$expected"
    sed 's/^/        /' "$WORK/out.txt"
  fi
}

new_repo nouveau-parcours
printf "test('filtre', async () => {});\n" >apps/web/test/filtre.e2e.ts
commit 'test(web): parcours du filtre'
expect 0 'nouveau parcours du front'

new_repo parcours-modifie
printf "test('fumée', async () => { /* vidé */ });\n" >apps/web/test/smoke.e2e.ts
commit 'test(web): assouplit'
expect 1 'parcours du front modifié sans justification'

new_repo parcours-justifie
printf "test('fumée', async () => { /* corrigé */ });\n" >apps/web/test/smoke.e2e.ts
commit "$(printf 'test(web): corrige\n\nJustification-test: F8-3 parcours établi faux par le triage')"
expect 0 'parcours du front modifié avec justification'

new_repo composant-modifie
printf "it('vide', () => {});\n" >apps/web/app/pages/index.spec.ts
commit 'test(web): vide'
expect 1 'test de composant modifié sans justification'

new_repo capture-attendue
printf 'autre\n' >apps/web/test/visual.e2e.ts-snapshots/desktop-1280.png
commit 'test(web): met à jour la capture'
expect 1 'capture attendue de Playwright modifiée sans justification'

new_repo capture-reference
git rm -q "$REFERENCE"
commit 'chore: retire une capture'
expect 1 'capture de référence du handoff supprimée sans justification'

new_repo playwright-config
printf 'export default { retries: 3 };\n' >apps/web/playwright.config.ts
commit 'chore: reprises'
expect 1 'configuration Playwright modifiée sans justification'

new_repo turbo-paquet
printf '{ "extends": ["//"], "tasks": { "test:e2e": { "cache": true } } }\n' >apps/web/turbo.json
commit 'chore: tâches du front'
expect 1 'turbo.json de paquet créé sans justification'

printf '\n%s réussi(s), %s échec(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
