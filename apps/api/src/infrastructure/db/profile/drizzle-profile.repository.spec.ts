import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleProfileRepository } from './drizzle-profile.repository.js';

interface Query {
  sql: string;
  params: unknown[];
}

/** Doublure sans base (driver « proxy ») : mémorise la requête et ses paramètres. */
function clientDouble(rows: unknown[][]) {
  const queries: Query[] = [];
  const db = drizzle(
    (sql, params) => {
      queries.push({ sql, params });
      return Promise.resolve({ rows });
    },
    { schema },
  );
  return { queries, client: { db } as unknown as DrizzleDatabaseClient };
}

/** Une ligne de résultat, dans l'ordre des colonnes du `select`. */
const ROW = [
  'Prénom',
  'Nom',
  'Ville',
  '/images/portrait.jpg',
  'Portrait',
  'Titre',
  'senior',
  ['Accroche'],
  'Intro',
  'Mission',
  'En ce moment',
  'Format',
  'Lieu',
  'Immédiate',
  '/cv/cv-fr.pdf',
];

describe('DrizzleProfileRepository : champs du design v6 (BF-1)', () => {
  it('renvoie le profil lu, champ par champ', async () => {
    const { client } = clientDouble([ROW]);

    await expect(new DrizzleProfileRepository(client).findProfile('fr')).resolves.toEqual({
      firstName: 'Prénom',
      lastName: 'Nom',
      location: 'Ville',
      picturePath: '/images/portrait.jpg',
      pictureAlt: 'Portrait',
      title: 'Titre',
      titleBadge: 'senior',
      taglines: ['Accroche'],
      intro: 'Intro',
      mission: 'Mission',
      currentActivity: 'En ce moment',
      seekingFormat: 'Format',
      seekingLocation: 'Lieu',
      seekingAvailability: 'Immédiate',
      cvPath: '/cv/cv-fr.pdf',
    });
  });

  it('renvoie null sans ligne servie (absente ou supprimée)', async () => {
    const { client } = clientDouble([]);

    await expect(new DrizzleProfileRepository(client).findProfile('fr')).resolves.toBeNull();
  });
});
