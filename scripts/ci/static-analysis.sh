#!/usr/bin/env bash
# Analyse statique en conteneur, par podman ou docker (scripts/container-engine.sh, CONTAINER_ENGINE pour
# imposer l'un des deux), images épinglées par digest (L14-08, L14-10) : rien d'installé sur l'hôte.
#   static-analysis.sh workflows   actionlint sur .github/workflows (syntaxe, expressions, déclencheurs,
#                                  scripts `run:` passés à shellcheck)
#   static-analysis.sh shell       shellcheck sur scripts/**/*.sh, .claude/hooks/run.sh, .husky/pre-commit
# Utilisé par `pnpm lint:workflows`, `pnpm lint:shell` (donc `pnpm check`) et par le job CI « analyse-statique ».
# Mise à jour d'une image : vérifier la version stable et le digest au registre, changer les deux ensemble.
set -euo pipefail

# rhysd/actionlint 1.7.12 (publiée le 30 mars 2026) et koalaman/shellcheck v0.11.0 (4 août 2025).
# Noms complets (docker.io/…) : podman refuse un nom court sans terminal pour choisir le registre.
ACTIONLINT_IMAGE='docker.io/rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667'
SHELLCHECK_IMAGE='docker.io/koalaman/shellcheck@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d'

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

# shellcheck source=scripts/container-engine.sh
source "$root/scripts/container-engine.sh"

# Moteur résolu au premier lancement. Sous podman, l'étiquetage SELinux du montage du dépôt est levé
# (lecture seule, sans réétiqueter les fichiers de l'hôte).
engine=''
engine_options=()
resolve_engine() {
  [ -n "$engine" ] && return
  engine="$(container_engine)"
  if [ "$engine" = podman ]; then
    engine_options=(--security-opt label=disable)
  fi
}

# SIMULATION=1 affiche la commande au lieu de la lancer (tests du script).
run_container() {
  resolve_engine
  if [ "${SIMULATION:-0}" = '1' ]; then
    echo "$engine run ${engine_options[*]} $*"
  else
    "$engine" run --rm "${engine_options[@]}" "$@"
  fi
}

case "${1:-}" in
  workflows)
    run_container -v "$root:/repo:ro" -w /repo "$ACTIONLINT_IMAGE" -color
    ;;
  shell)
    # SC1112 (guillemets typographiques dans une chaîne) n'est écarté que pour les tests protégés de
    # scripts/ci/tests/*.test.sh : on ne les retouche pas, et leurs libellés français contiennent
    # volontairement des apostrophes et guillemets typographiques. Tous les autres scripts sont
    # analysés sans exclusion.
    mapfile -t scripts < <(find scripts -name '*.sh' -not -path 'scripts/ci/tests/*.test.sh' | sort)
    mapfile -t protected_tests < <(find scripts/ci/tests -maxdepth 1 -name '*.test.sh' | sort)
    run_container -v "$root:/repo:ro" -w /repo "$SHELLCHECK_IMAGE" "${scripts[@]}" .claude/hooks/run.sh
    run_container -v "$root:/repo:ro" -w /repo "$SHELLCHECK_IMAGE" -e SC1112 "${protected_tests[@]}"
    # Aucune ligne shebang (convention husky 9, lancé par `sh -e`) : dialecte à fournir.
    run_container -v "$root:/repo:ro" -w /repo "$SHELLCHECK_IMAGE" --shell=sh .husky/pre-commit
    ;;
  *)
    echo "usage : static-analysis.sh workflows|shell" >&2
    exit 2
    ;;
esac
