#!/usr/bin/env bash
# Moteur de conteneurs des scripts locaux (base de dev et de test, navigateurs des e2e, pile locale,
# nettoyage du CV PDF). À sourcer : définit container_engine, qui affiche le moteur retenu.
#   CONTAINER_ENGINE=podman|docker   impose le moteur ;
#   sinon docker s'il est installé (exécuteurs de la CI GitHub), sinon podman (poste de Julien, sans
#   docker).
# Avec podman-docker, la commande `docker` est en fait podman (`docker --version` le dit) : le moteur
# retenu est alors podman, pour que ses réglages propres s'appliquent (SELinux, propriétaire des
# fichiers, oom_score_adj de la pile locale).
# Le déploiement de production (scripts/deploy/common.sh) reste sur docker.

container_engine() {
  local engine="${CONTAINER_ENGINE:-}"
  if [ -z "${engine}" ]; then
    if command -v docker >/dev/null 2>&1; then
      engine=docker
    elif command -v podman >/dev/null 2>&1; then
      engine=podman
    else
      echo "ni podman ni docker n'est installé" >&2
      return 1
    fi
  fi
  case "${engine}" in
  podman | docker) ;;
  *)
    echo "CONTAINER_ENGINE invalide : ${engine} (podman ou docker)" >&2
    return 1
    ;;
  esac
  command -v "${engine}" >/dev/null 2>&1 || {
    echo "${engine} est introuvable" >&2
    return 1
  }
  if [ "${engine}" = docker ] && command -v podman >/dev/null 2>&1 &&
    docker --version 2>/dev/null | grep -qi podman; then
    engine=podman
  fi
  echo "${engine}"
}
