#!/usr/bin/env bash
# L14-11 (recette du lot 16, point ouvert 2) : FORBIDDEN_RE de scripts/ci/check-tests-integrity.sh
# reconnaît un marqueur interdit suivi de plusieurs méthodes de l'API de test de Vitest (un saut,
# puis concurrent, puis each…). Comparaison de l'ancien et du nouveau sur toutes les formes du
# corpus : chaque forme est écrite dans son propre fichier de test, le script est lancé une fois et
# son verdict par fichier est comparé à celui des expressions d'avant L14-11 (copie figée
# ci-dessous). Aucune forme refusée avant ne devient acceptée ; les formes ordinaires restent
# acceptées. Lancé par `pnpm integrity:test` et par la CI.
#
# Les marqueurs sont construits à l'exécution : ce fichier n'en contient aucun littéralement.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-chaine-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# Copie figée des expressions du script avant L14-11 (« ancien »).
OLD_PW_PREFIX='(^|[^A-Za-z0-9_$.])test(\.describe)?(\.(serial|parallel))?'
OLD_FORBIDDEN_RE='\.(skip|only|todo|skipIf|runIf)([[:space:]]*\(|\.[A-Za-z]+[[:space:]]*[(`])|(v8|c8|istanbul)[[:space:]]+ignore|node:coverage[[:space:]]+(ignore|disable)|'"${OLD_PW_PREFIX}"'\.(fixme|slow)[[:space:]]*\('
OLD_CHAIN='(each|for|concurrent|sequential|shuffle|skip|only|todo|fails|skipIf|runIf|extend|scoped|override)'
OLD_FAILS_RE='\.(fails)([[:space:]]*\(|(\.'"${OLD_CHAIN}"')+[[:space:]]*[(`])|'"${OLD_PW_PREFIX}"'\.fail[[:space:]]*\('

SKIP="$(printf '%s' sk)ip"
ONLY="$(printf '%s' on)ly"
TODO="$(printf '%s' to)do"
SKIP_IF="$(printf '%s' skip)If"
RUN_IF="$(printf '%s' run)If"
FAILS="$(printf '%s' fa)ils"
FIXME="$(printf '%s' fix)me"
SLOW="$(printf '%s' sl)ow"
FAIL="$(printf '%s' fa)il"
IGN="$(printf '%s' ign)ore"
BT='`'

# Formes enchaînées sur plusieurs méthodes, que l'ancien ne voyait pas.
CHAINED=(
  "it.${SKIP}.concurrent.each([1])('x', () => {});"
  "it.${SKIP}.concurrent.each${BT}a${BT}('x', () => {});"
  "it.${ONLY}.sequential.for([1])('x', () => {});"
  "describe.${SKIP}.shuffle.each([1])('x', () => {});"
  "test.${TODO}.concurrent.each([1])('x');"
  "it.${SKIP}.concurrent.each ([1])('x', () => {});"
  "it.${RUN_IF}.concurrent.each([1])('x', () => {});"
  "it.${SKIP_IF}.concurrent.extend({})('x', () => {});"
  "it.${ONLY}.concurrent.sequential.shuffle.each([1])('x', () => {});"
)
# Formes déjà refusées avant L14-11 (marqueur interdit, ou échec attendu sans justification).
KNOWN=(
  "it.${SKIP}('x', () => {});"
  "it.${ONLY}('x', () => {});"
  "it.${TODO}('x');"
  "it.${SKIP_IF}(true)('x', () => {});"
  "it.${RUN_IF}(false)('x', () => {});"
  "describe.${SKIP}('x', () => {});"
  "test.${ONLY} ('x', () => {});"
  "it.${SKIP}.each([1])('x', () => {});"
  "it.${SKIP}.each${BT}a${BT}('x', () => {});"
  "it.${ONLY}.concurrent('x', () => {});"
  "it.${SKIP}.quelconque('x', () => {});"
  "it.concurrent.${SKIP}('x', () => {});"
  "test.${TODO}.concurrent.${SKIP}('x');"
  "it.each([1]).${SKIP}('x');"
  "test.${FIXME}('x', async () => {});"
  "test.${SLOW}();"
  "test.describe.${FIXME}('x', () => {});"
  "test.describe.serial.${FIXME}('x', () => {});"
  "/* v8 ${IGN} next */"
  "// c8 ${IGN} next"
  "/* istanbul ${IGN} else */"
  "// node:coverage ${IGN} next"
  "// node:coverage $(printf '%s' dis)able"
  "it.${FAILS}('x', () => {});"
  "it.${FAILS}.each([1])('x', () => {});"
  "it.${FAILS}.concurrent.each([1])('x', () => {});"
  "it.${FAILS}.for${BT}a${BT}('x', () => {});"
  "it.concurrent.${FAILS}('x', () => {});"
  "it.${SKIP}.${FAILS}.each([1])('x', () => {});"
  "test.${FAIL}('x', async () => {});"
)
# Formes ordinaires : acceptées avant, elles doivent le rester.
ORDINARY=(
  "const scope = GRANTABLE.${FAILS}.includes(role);"
  "const roles = GRANTABLE.${FAILS}.map((r) => r);"
  "if (options.${SKIP}.length > 0) run();"
  "const items = cfg.${TODO}.items.map((x) => x);"
  "const v = state.${SKIP}.items.filter(Boolean);"
  "Un marqueur it.${ONLY} cité en prose ne compte pas."
  "list.skipped('x');"
  "GRANTABLE.${FAILS}.quelconque('x');"
)

passed=0
failed=0
check() {
  if [ "$1" = "$2" ]; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$3"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (obtenu %s, attendu %s)\n' "$3" "$1" "$2"
  fi
}

# Verdict de l'ancien script pour une ligne ajoutée sans justification : refusé ou accepté.
old_verdict() {
  if [[ "$1" =~ $OLD_FORBIDDEN_RE || "$1" =~ $OLD_FAILS_RE ]]; then echo refusé; else echo accepté; fi
}

repo="$WORK/corpus"
mkdir -p "$repo/apps/api/src"
cd "$repo"
git init -q -b develop
git config user.name 'Test'
git config user.email 'ci@noreply.invalid'
git config commit.gpgsign false
printf 'export const answer = 42;\n' >apps/api/src/app.ts
git add -A
git commit -q -m 'base'
git checkout -q -b lot/essai

declare -a lines=() kinds=()
for l in "${CHAINED[@]}"; do lines+=("$l") kinds+=(chained); done
for l in "${KNOWN[@]}"; do lines+=("$l") kinds+=(known); done
for l in "${ORDINARY[@]}"; do lines+=("$l") kinds+=(ordinary); done
for i in "${!lines[@]}"; do
  printf '%s\n' "${lines[$i]}" >"apps/api/src/f${i}.spec.ts"
done
git add -A
git commit -q -m 'test: corpus sans justification'
code=0
bash "$SCRIPT" develop >"$WORK/out.txt" 2>&1 || code=$?
check "$code" 1 'le corpus contient des formes refusées : code 1'

for i in "${!lines[@]}"; do
  line="${lines[$i]}"
  if grep -Eq "apps/api/src/f${i}\.spec\.ts( |:|$)" "$WORK/out.txt"; then now=refusé; else now=accepté; fi
  before="$(old_verdict "$line")"
  case "${kinds[$i]}" in
    chained)
      check "$before" accepté "ancien, non vu : $line"
      check "$now" refusé "nouveau, refusé : $line"
      ;;
    known)
      check "$before" refusé "ancien, refusé : $line"
      check "$now" refusé "nouveau, toujours refusé : $line"
      ;;
    ordinary)
      check "$before" accepté "ancien, accepté : $line"
      check "$now" accepté "nouveau, toujours accepté : $line"
      ;;
  esac
done

printf '\n%s réussi(s), %s échoué(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
