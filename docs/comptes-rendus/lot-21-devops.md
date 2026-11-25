# Lot 21 : DevOps (revue par abonnement)

## Fait

- `.github/workflows/revue-pr.yml` : entrée `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`
  (vérifiée dans l'`action.yml` du SHA `acfe799…`, v1.0.286) à la place de `anthropic_api_key` ; modèle
  `claude-opus-5-5` inchangé ; garde fork/brouillon inchangée, avant tout usage du secret.
- `docs/deploiement.md` : marche à suivre (`claude setup-token`, `gh secret set`), limites de l'abonnement partagées.

## Décisions

- Comptes rendus du lot 20 non réécrits (historique).

## Points ouverts

- Julien pose le secret `CLAUDE_CODE_OAUTH_TOKEN`.
- Le modèle accepté avec un jeton d'abonnement n'est pas vérifiable hors exécution réelle.
- `.claude/agents/dev-devops.md` (ligne 22) cite encore `.github/dependabot.yml` : hors autorisation.
- `CLAUDE.md` ne mentionne pas `ANTHROPIC_API_KEY`.
