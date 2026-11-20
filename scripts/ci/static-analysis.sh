#!/usr/bin/env bash
# Analyse statique par Docker, images épinglées par digest (L14-08, L14-10) : rien d'installé sur l'hôte.
#   static-analysis.sh workflows   actionlint sur .github/workflows (syntaxe, expressions, déclencheurs,
#                                  scripts `run:` passés à shellcheck)
#   static-analysis.sh shell       shellcheck sur scripts/**/*.sh, .claude/hooks/run.sh, .husky/pre-commit
# Utilisé par `pnpm lint:workflows`, `pnpm lint:shell` (donc `pnpm check`) et par le job CI « analyse-statique ».
# Mise à jour d'une image : vérifier la version stable et le digest au registre, changer les deux ensemble.
set -euo pipefail

# rhysd/actionlint 1.7.12 (publiée le 30 mars 2026) et koalaman/shellcheck v0.11.0 (4 août 2025).
ACTIONLINT_IMAGE='rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667'
SHELLCHECK_IMAGE='koalaman/shellcheck@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d'

# SIMULATION=1 affiche la commande Docker au lieu de la lancer (tests du script).
run_docker() {
  if [ "${SIMULATION:-0}" = '1' ]; then
    echo "docker run $*"
  else
    docker run --rm "$@"
  fi
}

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

case "${1:-}" in
  workflows)
    run_docker -v "$root:/repo:ro" -w /repo "$ACTIONLINT_IMAGE" -color
    ;;
  shell)
    # SC1112 (guillemets typographiques dans une chaîne) n'est écarté que pour les trois tests
    # ci-dessous : tests protégés (on ne les retouche pas), guillemets typographiques voulus dans des
    # libellés français. Tous les autres scripts sont analysés sans exclusion.
    quotes_tests=(
      scripts/ci/tests/fails-marker.test.sh
      scripts/ci/tests/paths.test.sh
      scripts/ci/tests/stryker-directive-line.test.sh
    )
    mapfile -t scripts < <(find scripts -name '*.sh' | sort | grep -vxF -f <(printf '%s\n' "${quotes_tests[@]}"))
    run_docker -v "$root:/repo:ro" -w /repo "$SHELLCHECK_IMAGE" "${scripts[@]}" .claude/hooks/run.sh
    run_docker -v "$root:/repo:ro" -w /repo "$SHELLCHECK_IMAGE" -e SC1112 "${quotes_tests[@]}"
    # Aucune ligne shebang (convention husky 9, lancé par `sh -e`) : dialecte à fournir.
    run_docker -v "$root:/repo:ro" -w /repo "$SHELLCHECK_IMAGE" --shell=sh .husky/pre-commit
    ;;
  *)
    echo "usage : static-analysis.sh workflows|shell" >&2
    exit 2
    ;;
esac
