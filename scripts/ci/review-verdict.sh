#!/usr/bin/env bash
# Verdict de la revue automatisée d'une PR (L20-05), lu dans le fichier d'exécution de l'action
# Claude Code (`execution_file` : tableau JSON des messages, dont un message `result` final).
#   review-verdict.sh <fichier>   code 0 : dernière ligne de verdict `VERDICT: OK`
#                                 code 1 : `VERDICT: BLOQUANT`, ou aucun verdict (absent = échec)
#                                 code 2 : paramètre manquant ou fichier illisible
# La ligne de verdict est cherchée seule sur sa ligne, dans le texte final de la revue ; la dernière
# l'emporte. Aucune valeur de la revue n'est exécutée : le texte n'est lu que par node et grep.
set -euo pipefail

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ] || [ ! -r "$file" ]; then
  echo "usage : review-verdict.sh <fichier d'exécution de l'action>" >&2
  exit 2
fi

# Texte du dernier message `result` (node : déjà là pour pnpm, aucun outil de plus sur l'hôte).
extract='const m = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).filter((x) => x && x.type === "result" && typeof x.result === "string"); process.stdout.write(m.length > 0 ? m[m.length - 1].result : "");'
if ! text="$(node -e "$extract" "$file" 2>/dev/null)"; then
  echo "Fichier d'exécution illisible (JSON attendu) : verdict absent, échec par prudence." >&2
  exit 1
fi

verdict="$(grep -E '^[[:space:]]*VERDICT: (BLOQUANT|OK)[[:space:]]*$' <<<"$text" | tail -n 1 | tr -d '[:space:]' || true)"
case "$verdict" in
  VERDICT:OK)
    echo "Revue : VERDICT: OK"
    ;;
  VERDICT:BLOQUANT)
    echo "Revue : VERDICT: BLOQUANT, la PR ne peut pas être fusionnée en l'état." >&2
    exit 1
    ;;
  *)
    echo "Revue : aucun verdict trouvé (ligne « VERDICT: OK » ou « VERDICT: BLOQUANT » attendue), échec par prudence." >&2
    exit 1
    ;;
esac
