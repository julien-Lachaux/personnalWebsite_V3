# Lot F11 : corrections (correcteur)

Date : 26 nov. 2026. Branche `lot/F11-optimisation`.

## Résultat

| Finding | Commit | Ce qui change | Preuve |
|---|---|---|---|
| RC-7 (F11-03) | aucun | rien | non fait : voir ci-dessous |
| RC-5 (suite de F11-04) | aucun | rien | non fait : voir ci-dessous |

Aucun fichier de production ni de test n'a été modifié.

## Non fait et pourquoi

Les deux entrées demandent de modifier un test existant (26 parcours `apps/web/test/*.e2e.ts` pour
RC-7, `apps/web/app/composables/seo/useSeo.spec.ts` pour RC-5). Le garde-fou refuse chacune de ces
écritures, malgré les autorisations `7250baa9` (RC-7) et `21b2ac9a` (RC-5) annoncées.

Démonstration :

```
Edit apps/web/app/composables/seo/useSeo.spec.ts
Garde-fous : refusé. modification d’un test existant : apps/web/app/composables/seo/useSeo.spec.ts.
Aucune autorisation « tests » de l'orchestrateur pour l'agent correcteur.

Edit apps/web/test/client-bundle.e2e.ts
Garde-fous : refusé. modification d’un test existant : apps/web/test/client-bundle.e2e.ts.
Aucune autorisation « tests » de l'orchestrateur pour l'agent correcteur.
```

Cause probable (lecture seule, sans rien modifier) : les deux autorisations sont bien dans
`/home/jlachaux/Projets/personnalWebsite_V3/.claude/hooks/state/authorizations.json` (id `7250baa9`,
agent `correcteur`, portée `tests`, ticket RC-7, les chemins des parcours ; id `21b2ac9a`, RC-5,
`useSeo.spec.ts` ; créées le 26 nov. 2026 à 16:36 UTC, valables 24 h, `bound_to: null`, non
révoquées). Mais la racine de l'état des hooks est `CLAUDE_PROJECT_DIR`
(`.claude/hooks/lib/state.mjs`, `stateRoot`), qui vaut ici le worktree
`/home/jlachaux/Projets/personnalWebsite_V3-f11`, dont `.claude/hooks/state/` ne contient ni
`authorizations.json` ni autre fichier d'autorisation (seulement `carry/` et `snapshots/`). Le hook ne
voit donc pas les grants créés depuis le checkout principal. Les autorisations ont été créées au
mauvais endroit pour ce worktree : à recréer depuis une session dont l'état est celui du worktree
f11, ou à faire lire par le worktree ; je n'y touche pas (`.claude/` interdit).

Conséquence sur l'ordre de travail : le test d'abord n'est pas possible pour RC-5 (le seul test qui
échouerait à cause du défaut est la réécriture de `useSeo.spec.ts:53-71`, et la correction de
production sans elle rend ces deux tests faux). Je n'ai donc rien modifié en production non plus.

Plan RC-5 prêt à appliquer dès l'autorisation visible (déjà vérifié par lecture) :

1. `useSeo.spec.ts` : les deux tests de `useSiteSeo` attendent `meta[name=description]` et
   `og:description` absents (`toBeNull`), `og:type` = `website`, `og:title` suivant le titre de la
   page, dans les deux langues ; ils échouent sur le code actuel.
2. `useSeo.ts` : `useSiteSeo` ne pose plus `description` ni `ogDescription` (reste `ogType` et
   `ogTitle: '%s'`) ; `seo.description` (fr et en) supprimée, `seo.homeDescription` renommée
   `seo.description` (`HomePage.vue:55` et CLAUDE.md l.184-185 suivent). Le texte de production
   reste identique : l'accueil, la déclaration d'accessibilité et la page travaux posent chacun leur
   description par `usePageSeo` ; `error.vue` n'appelle pas `useSiteSeo`, donc 404 et 50x ne posent
   aujourd'hui aucune description et gardent ce comportement. `workInProgress.description` reste en
   dur (D51 (1)).

## Base de mesure de F11-03

Une passe complète des 2 632 tests (projets × parcours, `--workers=2`) a été lancée pour relever le
nombre de tests passés avant migration ; je l'ai interrompue (processus hôte du lanceur seulement,
pas de podman) une fois le blocage établi. Aucun résultat à citer. Le conteneur des navigateurs n'a
pas été touché ; `.output/public` a été régénéré une fois (`generate:fixtures`, vert) sur l'état
commité.

## Décisions

Aucune. Arrêt sur les deux entrées (sortie honorable).

## Points ouverts

- Recréer ou rendre visibles les autorisations `7250baa9` et `21b2ac9a` pour le worktree
  `personnalWebsite_V3-f11` (ou autoriser le correcteur depuis une session dont `CLAUDE_PROJECT_DIR`
  est ce worktree), puis relancer le correcteur sur RC-7 (plan de `lot-F11-lead.md`, F11-03) et RC-5.
- Les vérifications de fin (lint, typecheck, `test:coverage`, parcours, `pnpm integrity`) n'ont pas été
  lancées : rien n'a changé.
