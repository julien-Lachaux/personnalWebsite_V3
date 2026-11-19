#!/usr/bin/env bash
# Intégrité des tests (couche 2 contre le contournement des tests par les agents).
#
# Compare la branche courante à son point de divergence avec la branche d'intégration et échoue si :
#   1. un fichier de test existant est modifié ou supprimé sans qu'un commit qui le touche porte une
#      ligne « Justification-test: <identifiant du finding> <raison> » ;
#   2. une configuration protégée (Vitest, couverture, turbo.json, pnpm-workspace.yaml, .husky,
#      .github/workflows, scripts/ci, .claude/settings.json, .claude/hooks) ou un script de test
#      d'un package.json change sans la même justification ;
#   3. une ligne ajoutée (commitée, modifiée ou non suivie) contient un marqueur de saut ou de focus
#      de Vitest ou un commentaire d'ignore de couverture ; le marqueur d'échec attendu (fails) est
#      admis seulement si un commit qui touche le fichier porte une ligne Justification-test ;
#   4. un fichier de code suivi contient l'un de ces marqueurs ou commentaires (tout l'arbre).
#
# Usage : check-tests-integrity.sh [référence de base]
#         (défaut : origin/v3/backend, sinon v3/backend). Code 0 : intègre ; 1 : écart ; 2 : usage.
#
# Ce script ne contient volontairement aucun marqueur littéral (motifs écrits en alternatives).

set -euo pipefail

base_ref="${1:-}"
if [ -z "$base_ref" ]; then
  for candidate in origin/v3/backend v3/backend; do
    if git rev-parse --verify -q "${candidate}^{commit}" >/dev/null; then
      base_ref="$candidate"
      break
    fi
  done
fi
if [ -z "$base_ref" ] || ! git rev-parse --verify -q "${base_ref}^{commit}" >/dev/null; then
  echo "Intégrité des tests : base « ${base_ref:-origin/v3/backend} » introuvable (git fetch ?)." >&2
  exit 2
fi
merge_base="$(git merge-base HEAD "$base_ref")"

# Motifs (expressions régulières étendues, chemins relatifs à la racine du dépôt).
TEST_RE='(^|/)[^/]+\.(spec|e2e-spec|test)\.[cm]?[jt]sx?$|(^|/)[^/]+\.test\.sh$|(^|/)[^/]+\.fixtures?\.[cm]?[jt]sx?$|(^|/)(test|tests|__tests__|fixtures|__fixtures__|__snapshots__)/|\.snap$'
CONFIG_RE='(^|/)vitest(\.[A-Za-z0-9_-]+)*\.(config|workspace)\.[cm]?[jt]s$|(^|/)vite\.config\.[cm]?[jt]s$|(^|/)\.(c8rc|nycrc)(\.json|\.ya?ml)?$|^turbo\.json$|^pnpm-workspace\.yaml$|^\.husky/|^\.github/workflows/|^scripts/ci/|^\.claude/settings\.json$|^\.claude/hooks/'
SCRIPT_RE='^[-+][[:space:]]*"(test|test:[^"]*|check|hooks:test|integrity|integrity:[^"]*|pretest|posttest|prepare)"[[:space:]]*:'
FORBIDDEN_RE='\.(skip|only|todo|skipIf|runIf)([[:space:]]*\(|\.[A-Za-z]+[[:space:]]*[(`])|(v8|c8|istanbul)[[:space:]]+ignore|node:coverage[[:space:]]+(ignore|disable)'
FAILS_RE='\.(fails)([[:space:]]*\(|\.[A-Za-z]+[[:space:]]*[(`])'
JUSTIFICATION_RE='^Justification-test: [^ ]+ [^ ]'

failures=0
fail() {
  printf '  ÉCHEC  %s\n' "$*" >&2
  failures=$((failures + 1))
}

# Vrai si un commit de la branche qui touche ce chemin porte une ligne Justification-test.
# (sortie capturée d'abord : avec pipefail, grep -q fermerait le tube et ferait échouer git log.)
justified() {
  local messages
  messages="$(git log --format='%B' "${merge_base}..HEAD" -- "$1")"
  grep -Eq "$JUSTIFICATION_RE" <<<"$messages"
}

echo "Intégrité des tests : HEAD comparé à ${base_ref} (point de divergence ${merge_base:0:12})"

# 1 et 2. Tests existants et configurations protégées.
while IFS=$'\t' read -r status path; do
  [ -n "$path" ] || continue
  if [[ "$status" != A && "$path" =~ $TEST_RE ]] && ! justified "$path"; then
    case "$status" in
      D) fail "test existant supprimé sans Justification-test : $path" ;;
      *) fail "test existant modifié sans Justification-test : $path" ;;
    esac
  fi
  if [[ "$path" =~ $CONFIG_RE && ! "$path" =~ $TEST_RE ]] && ! justified "$path"; then
    fail "configuration protégée modifiée sans Justification-test ($status) : $path"
  fi
done < <(git diff --name-status --no-renames "$merge_base" HEAD)

# 2 bis. Scripts de test des package.json.
while IFS= read -r pkg; do
  changes="$(git diff -U0 "$merge_base" HEAD -- "$pkg" | grep -Ev '^(\+\+\+|---)' || true)"
  if grep -Eq "$SCRIPT_RE" <<<"$changes"; then
    justified "$pkg" || fail "script de test modifié sans Justification-test : $pkg"
  fi
done < <(git diff --name-only "$merge_base" HEAD -- 'package.json' '**/package.json')

# 3. Marqueurs dans les lignes ajoutées depuis le point de divergence (arbre de travail compris),
#    puis dans les fichiers non suivis.
added_lines() {
  git diff -U0 --no-color --no-ext-diff "$merge_base" -- . |
    awk '/^\+\+\+ /{ file = substr($0, 5); sub(/^b\//, "", file); next } /^\+/{ print file "\t" substr($0, 2) }'
  git ls-files -z -o --exclude-standard | while IFS= read -r -d '' f; do
    if [ -f "$f" ] && [ "$(wc -c <"$f")" -lt 2097152 ] && grep -Iq . "$f"; then
      awk -v file="$f" '{ print file "\t" $0 }' "$f"
    fi
  done
}
declare -A reported=()
while IFS=$'\t' read -r file line; do
  if [[ "$line" =~ $FORBIDDEN_RE ]]; then
    fail "marqueur de saut, de focus ou commentaire d'ignore ajouté : $file : ${line:0:120}"
  elif [[ "$line" =~ $FAILS_RE && -z "${reported[$file]:-}" ]]; then
    reported[$file]=1
    justified "$file" || fail "test en échec attendu ajouté sans Justification-test : $file"
  fi
done < <(added_lines)

# 4. Tout l'arbre suivi : aucun marqueur interdit dans un fichier de code.
while IFS= read -r hit; do
  fail "marqueur interdit dans l'arbre : ${hit:0:160}"
done < <(git grep -nIE "$FORBIDDEN_RE" -- '*.ts' '*.tsx' '*.mts' '*.cts' '*.js' '*.mjs' '*.cjs' '*.sh' || true)

if [ "$failures" -gt 0 ]; then
  echo "Intégrité des tests : ${failures} écart(s). Un test ou une configuration protégée ne change que si le triage l'a établi faux, avec « Justification-test: <identifiant> <raison> » dans le commit (CLAUDE.md, « Agents et garde-fous »)." >&2
  exit 1
fi
echo "Intégrité des tests : OK"
