# Brief back-002 : deux défauts du script d'intégrité des tests

Demandeur : session front, 20 novembre 2026. Validé par Julien le même jour (décision D16 de
`docs/05-front-organisation.md`). Destinataire : session back, propriétaire de
`scripts/ci/check-tests-integrity.sh` et des hooks.

Les deux défauts sont antérieurs au front ; ils ont été constatés par le lead-architecte pendant le
lot F0 (détail : `docs/comptes-rendus/lot-F0-lead.md`, points ouverts 7 et 9). Ils ne bloquent rien
aujourd'hui, mais refusent à tort des commits légitimes.

## BF-8 Noms de fichiers non ASCII
`git diff` cite les chemins accentués (`"b/apps/web/test/cass\303\251.e2e.ts"`) : la recherche d'une
ligne `Justification-test` sur ce fichier (`git log -- <chemin cité>`) ne le retrouve pas, et un
marqueur justifié dans un fichier au nom accentué est refusé. Piste : `git -c core.quotePath=false`
(ou `-z`) dans les appels concernés. Test de non-régression : un fichier de test au nom accentué,
modifié avec une Justification-test, passe ; le même sans justification échoue.

## BF-9 Faux positif du motif d'échec attendu
`FAILS_RE` du script d'intégrité et `MARKER_RE` des hooks prennent un appel `includes` sur la portée
d'échec attendu de `GRANTABLE` (forme « point, nom de la portée, point, méthode, parenthèse »,
prévue pour l'enchaînement `each` de Vitest) pour un marqueur. Resserrer le motif sur les seules
méthodes de Vitest et Playwright qui déclarent un test en échec attendu, sans affaiblir la
détection existante (les cas actuels de `scripts/ci/tests/` et `.claude/hooks/tests/` restent verts).

Règles habituelles : autorisation de configuration protégée, `Justification-test: BF-8` / `BF-9`,
tests ajoutés, aucun test existant affaibli. Chaque commit cite son ticket.
