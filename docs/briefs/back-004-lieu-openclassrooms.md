# Brief back-004 : lieu de l'expérience OpenClassrooms

Demandeur : session front, 20 novembre 2026. Validé par Julien le même jour. Destinataire : session
back.

Constat (lot F4, `docs/comptes-rendus/lot-F4-dev-front.md`) : la ligne « lieu, mode · contrat » de la
carte d'expérience est composée par le front à partir de `location`, `workMode` et `contractType`
(`docs/04-front-donnees.md`). Pour `openclassrooms-mentor`, le seed donne `location = 'À distance'`
(`'Remote'` en `en`) et `work_mode = 'remote'` : la carte affiche « À distance, à distance ». Le lieu
répète le mode de travail ; il n'y a pas de lieu physique.

## BF-12
- Seed `db/seeds/0004_experiences.sql` : `location` à `null` pour `openclassrooms-mentor` en `fr`
  et en `en` (la colonne est nullable, comme pour la pause professionnelle).
- `docs/traductions-a-relire.md` : retirer la ligne de cette traduction si elle y figure.
- Tests : un e2e (ou un cas existant étendu par un nouveau test) qui vérifie que l'expérience est
  servie avec `location: null` dans les deux langues ; aucun test existant affaibli (s'il en faut
  modifier un, autorisation « tests » et `Justification-test: BF-12`).

Résultat attendu côté front : « à distance » (fr) et « remote » (en), comme la maquette.
