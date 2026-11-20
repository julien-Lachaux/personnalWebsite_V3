# Brief back-003 : faux positifs du hook de fin de tâche (instantanés)

Demandeur : session front, 20 novembre 2026. Validé par Julien le même jour. Destinataire : session
back, propriétaire de `.claude/hooks/`. Les deux défauts ont bloqué chaque fin de tour de la session
front pendant plusieurs heures, sans aucune modification réelle d'oracle.

Code concerné : `verifySnapshot` et `committedWithJustification` dans `.claude/hooks/lib/state.mjs`,
`verify` dans `.claude/hooks/guard.mjs`.

## BF-10 Fichier devenu protégé en cours de session, pris pour une création
Scénario constaté :
1. La session démarre sur `develop` à `e665972` ; la politique (`lib/policy.mjs`) ne protège alors
   aucune configuration Playwright.
2. L'instantané du worktree F0 est pris avec cette politique : `apps/web/playwright.config.ts`, déjà
   présent, n'y figure pas (il n'est pas encore un oracle).
3. La fusion de F0 (commits `9ed189d`, `6b9b0b2`) ajoute ce fichier aux oracles ; les hooks
   s'exécutent depuis le checkout principal et appliquent aussitôt la nouvelle politique.
4. À chaque fin de tour, `verifySnapshot` voit une configuration absente de l'instantané, donc
   « créée », et cherche une justification dans `<head de l'instantané>..HEAD` ; l'instantané du
   worktree avait pour `head` la tête de la branche (`2616aa3`), la plage est vide : violation, alors
   que le fichier, créé par `0d24bda` avec sa ligne Justification-test, n'a pas changé.

Correction attendue : un fichier dont le contenu actuel est identique à son contenu au commit `head`
de l'instantané (`showAt(top, head, rel)`) n'est ni créé ni modifié depuis l'instantané, même s'il
n'était pas un oracle à ce moment-là. Test de non-régression : instantané pris, puis la politique
élargie à un fichier existant inchangé → aucune violation ; le même fichier modifié ensuite sans
justification → violation.

## BF-11 Worktree retiré dont il reste des fichiers générés
Scénario constaté : `git worktree remove` du worktree F0 (fusionné, propre), puis un serveur
`nuxt dev` orphelin y recrée `apps/web/.nuxt/` (4 fichiers générés). Le dossier existe de nouveau,
`verifySnapshot` ne s'arrête pas à `!existsSync(top)` et signale **tous** les oracles de
l'instantané comme « oracle supprimé » (plus de 200 lignes).

Correction attendue : un instantané dont la racine n'est plus un dépôt git valide (worktree retiré :
plus de `.git`, ou `git rev-parse --show-toplevel` différent de `top`) est ignoré et supprimé, comme
une racine absente. Test de non-régression : instantané d'un worktree, retrait du worktree, recréation
d'un sous-dossier non versionné → aucune violation ; un worktree toujours présent dont on supprime un
oracle → violation.

## Règles
Autorisation de configuration protégée sur les fichiers des hooks et leurs tests, `Justification-test:
BF-10` / `BF-11`, tests ajoutés dans `.claude/hooks/tests/`, aucun test existant affaibli, `pnpm
hooks:test` vert. Chaque commit cite son ticket.
