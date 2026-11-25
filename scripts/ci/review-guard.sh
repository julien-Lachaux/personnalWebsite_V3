#!/usr/bin/env bash
# Garde du job « Revue PR (Claude) » (L20) : une PR issue d'un fork ou en brouillon ne reçoit pas de
# revue automatique et le job ÉCHOUE (un job sauté compte comme réussi pour GitHub : la fusion
# serait permise). Aucune action ni secret n'est utilisé avant cette étape.
#   review-guard.sh <dépôt de la branche de tête> <dépôt courant> <brouillon : true|false>
#   code 0 : revue possible ; code 1 : fork ou brouillon (message clair) ; code 2 : paramètre invalide
set -euo pipefail

if [ "$#" -ne 3 ] || [ -z "$1" ] || [ -z "$2" ]; then
  echo "usage : review-guard.sh <dépôt de tête> <dépôt courant> <true|false>" >&2
  exit 2
fi
case "$3" in
  true | false) ;;
  *)
    echo "usage : review-guard.sh <dépôt de tête> <dépôt courant> <true|false>" >&2
    exit 2
    ;;
esac

if [ "$1" != "$2" ]; then
  echo "PR issue d'un fork : pas de revue automatique, fusion interdite." >&2
  exit 1
fi
if [ "$3" = 'true' ]; then
  echo "PR en brouillon : passer en prête pour la revue." >&2
  exit 1
fi
echo "Revue possible : PR du dépôt, prête pour la revue."
