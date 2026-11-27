#!/usr/bin/env bash
# Tests de scripts/ci/front-bundle-budget.mjs (F11-06, D50) : site vert, Zod, lecture de l'API, fixtures,
# budget dépassé, script d'entrée compté une seule fois, résumé de job, entrées invalides.
# Les apostrophes simples portent des accents graves littéraux (cellules Markdown) : rien à développer.
# shellcheck disable=SC2016
set -euo pipefail
# En CI, GitHub Actions pose GITHUB_STEP_SUMMARY : le script écrirait alors son tableau dans ce fichier et
# rien sur la sortie que les cas lisent. Les cas partent donc sans la variable ; celui du résumé de job la
# pose lui-même.
unset GITHUB_STEP_SUMMARY
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script=scripts/ci/front-bundle-budget.mjs
fail=0
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
is() { # description, obtenu, attendu
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (obtenu « $2 », attendu « $3 »)"; fail=1; fi
}
has() { # description, texte, fragment attendu
  if grep -qF -- "$3" <<<"$2"; then echo "ok   $1"; else echo "FAIL $1 (« $3 » absent de « $2 »)"; fail=1; fi
}
code() { # code de sortie de la commande
  local s=0
  "$@" >/dev/null 2>&1 || s=$?
  echo "$s"
}
noise() { head -c "$1" /dev/urandom | base64 -w0; } # texte incompressible de la taille voulue environ

# Fixtures factices : douze textes de plus de 40 caractères.
mkdir -p "$tmp/fixtures"
{
  echo "export const cvFr = {"
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    echo "  texte$i: 'Texte de fixture numéro $i, assez long pour ne figurer dans aucun code.',"
  done
  echo "};"
} >"$tmp/fixtures/cv.fr.ts"

site() { # nom : site minimal (un script d'entrée, un script préchargé), pages / et /en
  local d="$tmp/$1"
  rm -rf "$d"
  mkdir -p "$d/_nuxt" "$d/en" "$d/accessibilite"
  echo 'export const entree = 1;' >"$d/_nuxt/entree.js"
  echo 'export const autre = 2;' >"$d/_nuxt/autre.js"
  local page='<html><head><link rel="modulepreload" as="script" crossorigin href="/_nuxt/entree.js"><link rel="modulepreload" as="script" crossorigin href="/_nuxt/autre.js"></head><body><script type="module" src="/_nuxt/entree.js" crossorigin></script></body></html>'
  echo "$page" >"$d/index.html"
  echo "$page" >"$d/en/index.html"
  echo "$page" >"$d/accessibilite/index.html"
}
run() { # site : sortie standard et erreur du script
  node "$script" "$tmp/$1" "$tmp/fixtures" 2>&1
}
status() { code node "$script" "$tmp/$1" "$tmp/fixtures"; }

site vert
is 'site conforme : code 0' "$(status vert)" 0
out="$(run vert)"
has 'tableau Markdown sur la sortie' "$out" '| Page | Scripts chargés | Bruts / gzip | Budget gzip |'
has 'page d’accueil mesurée' "$out" '| `/` | 2 |'
has 'page anglaise mesurée' "$out" '| `/en` | 2 |'
has 'page d’accessibilité mesurée, pour information' "$out" '| `/accessibilite` | 2 |'
has 'budget respecté' "$out" 'respecté'

site zod
echo 'const e = x._zod.def; class ZodError {}' >"$tmp/zod/_nuxt/autre.js"
is 'Zod présent : code 1' "$(status zod)" 1
has 'Zod : script et motif nommés' "$(run zod)" 'Le script _nuxt/autre.js contient Zod'

site api
echo 'fetch("/api/v1/cv?lang=fr")' >"$tmp/api/_nuxt/autre.js"
is 'lecture de l’API présente : code 1' "$(status api)" 1
has 'lecture de l’API : message' "$(run api)" 'la lecture de l’API du CV'

site avecfix
echo 'const t = "Texte de fixture numéro 7, assez long pour ne figurer dans aucun code.";' >"$tmp/avecfix/_nuxt/entree.js"
is 'fixture présente : code 1' "$(status avecfix)" 1
has 'fixtures : message' "$(run avecfix)" 'contient les fixtures du CV'

site lourd
noise 250000 >"$tmp/lourd/_nuxt/autre.js"
is 'budget dépassé : code 1' "$(status lourd)" 1
out="$(run lourd || true)"
has 'budget dépassé : message' "$out" 'au-dessus du budget de 152306 o'
has 'budget dépassé : tableau' "$out" 'DÉPASSÉ'

# Un script d'entrée (aussi en modulepreload) d'environ 100 ko gzip : compté deux fois, il dépasserait
# le budget ; compté une fois, il le respecte.
site entree
noise 130000 >"$tmp/entree/_nuxt/entree.js"
is 'script d’entrée compté une seule fois : code 0' "$(status entree)" 0
has 'script d’entrée : deux scripts distincts' "$(run entree)" '| `/` | 2 |'

# Résumé de job : le tableau va dans $GITHUB_STEP_SUMMARY, rien sur la sortie standard.
summary="$tmp/summary.md"
: >"$summary"
stdout="$(GITHUB_STEP_SUMMARY="$summary" node "$script" "$tmp/vert" "$tmp/fixtures")"
is 'résumé de job : sortie standard vide' "$stdout" ''
has 'résumé de job : tableau écrit' "$(cat "$summary")" '## Poids du JavaScript du site généré (D50)'

is 'site absent : code 1' "$(code node "$script" "$tmp/absent" "$tmp/fixtures")" 1
mkdir -p "$tmp/vide/_nuxt"
echo '<html></html>' >"$tmp/vide/index.html"
is 'aucun script : code 1' "$(code node "$script" "$tmp/vide" "$tmp/fixtures")" 1
is 'dossier des fixtures absent : code 1' "$(code node "$script" "$tmp/vert" "$tmp/absent")" 1
mkdir -p "$tmp/sans-fixture"
is 'aucune fixture : code 1' "$(code node "$script" "$tmp/vert" "$tmp/sans-fixture")" 1
mkdir -p "$tmp/peu"
echo "export const cv = { a: 'Un seul texte de fixture assez long pour passer le seuil.' };" >"$tmp/peu/cv.fr.ts"
is 'trop peu de textes de fixtures : code 1' "$(code node "$script" "$tmp/vert" "$tmp/peu")" 1
site manquant
echo '<html><link rel="modulepreload" href="/_nuxt/fantome.js"></html>' >"$tmp/manquant/index.html"
is 'script chargé mais absent : code 1' "$(status manquant)" 1
site sans-accueil
echo '<html></html>' >"$tmp/sans-accueil/index.html"
rm "$tmp/sans-accueil/en/index.html" "$tmp/sans-accueil/accessibilite/index.html"
has 'page d’accueil sans script : zéro script' "$(run sans-accueil)" '| `/` | 0 |'

exit "$fail"
