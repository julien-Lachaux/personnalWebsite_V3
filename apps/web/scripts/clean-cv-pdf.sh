#!/usr/bin/env bash
# Nettoie les métadonnées d'un CV PDF avant de le versionner dans apps/web/public/cv/ (D22, SPEC § 11) :
# dictionnaire d'information (auteur, titre, sujet, logiciel, dates) et flux XMP retirés, PDF réécrit
# par qpdf (les objets retirés ne restent pas dans le fichier, contrairement à une mise à jour
# incrémentale), identifiant de fichier déterministe, sans flux d'objets (dictionnaires en clair, que
# app/cv-pdf.spec.ts relit). Le contenu visible des pages n'est pas modifié.
#
# Outils en conteneur (rien d'installé sur l'hôte), par podman ou docker (scripts/container-engine.sh,
# CONTAINER_ENGINE pour imposer l'un des deux) : Alpine épinglée par digest, qpdf, jq et exiftool en
# version exacte ; exiftool affiche les métadonnées avant et après.
#
# Usage : bash apps/web/scripts/clean-cv-pdf.sh <source.pdf> <destination.pdf>
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage : $0 <source.pdf> <destination.pdf>" >&2
  exit 2
fi

source_file=$(realpath "$1")
destination_dir=$(realpath "$(dirname "$2")")
destination_name=$(basename "$2")

if [[ ! -f "$source_file" ]]; then
  echo "source introuvable : $1" >&2
  exit 1
fi

# shellcheck source=scripts/container-engine.sh
source "$(dirname "${BASH_SOURCE[0]}")/../../../scripts/container-engine.sh"
engine=$(container_engine)

# Propriétaire du PDF écrit : l'utilisateur courant. Podman sans privilèges associe le root du
# conteneur à cet utilisateur (0:0 dedans) ; il faut aussi lever l'étiquetage SELinux des montages,
# sans réétiqueter les dossiers de l'hôte.
owner="$(id -u):$(id -g)"
engine_options=()
if [[ $engine == podman ]]; then
  if [[ $(podman info --format '{{.Host.Security.Rootless}}') == true ]]; then
    owner='0:0'
  fi
  engine_options+=(--security-opt label=disable)
fi

image='docker.io/library/alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf'

"$engine" run --rm "${engine_options[@]}" \
  -v "$source_file:/work/source.pdf:ro" \
  -v "$destination_dir:/work/out" \
  -e "DESTINATION=/work/out/$destination_name" \
  -e "OWNER=$owner" \
  "$image" sh -euc '
    apk add --no-cache -q qpdf=12.3.2-r0 exiftool=13.55-r0 jq=1.8.2-r0 >/dev/null
    echo "== avant (exiftool) =="
    exiftool -a -G1 -s -n /work/source.pdf
    # 1. qpdf retire le flux XMP et le dictionnaire d information, sauf sa date de modification
    #    (--remove-info la garde) ;
    # 2. la référence /Info est alors ôtée de la fin de fichier (trailer) dans la forme JSON de qpdf :
    #    à la réécriture, qpdf n écrit que les objets atteignables, le dictionnaire disparaît.
    qpdf --remove-info --remove-metadata --deterministic-id /work/source.pdf /tmp/step.pdf
    qpdf --json-output=2 /tmp/step.pdf /tmp/step.json
    jq ".qpdf[1].trailer.value |= del(.\"/Info\")" /tmp/step.json > /tmp/clean.json
    qpdf --json-input --deterministic-id --object-streams=disable /tmp/clean.json "$DESTINATION"
    qpdf --check "$DESTINATION" >/dev/null
    chown "$OWNER" "$DESTINATION"
    echo "== après (exiftool) =="
    exiftool -a -G1 -s -n "$DESTINATION"
  '
