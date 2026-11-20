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

/** Valeur du paramètre lié juste après `fragment` (`fragment $n`) dans la requête. */
function paramAfter({ sql, params }: Query, fragment: string): unknown {
  const index = sql.indexOf(`${fragment} $`);
  expect(index, fragment).toBeGreaterThan(-1);
  const position = Number(/^\$(\d+)/.exec(sql.slice(index + fragment.length + 1))?.[1]);
  return params[position - 1];
}

const TEXT_COLUMNS = [
  'title_badge',
  'intro',
  'mission',
  'current_activity',
  'seeking_format',
  'seeking_location',
  'seeking_availability',
  'cv_path',
];

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

describe('DrizzleProfileRepository : lignes de traduction complètes (BF-1)', () => {
  it.each(['fr', 'en'])(
    'n’accepte, dans la jointure %s, qu’une ligne aux colonnes du design v6 non vides',
    async (alias) => {
      const { queries, client } = clientDouble([ROW]);

      await new DrizzleProfileRepository(client).findProfile('en');

      const [query] = queries;
      expect(query).toBeDefined();
      const table = `"profile_translations_${alias}"`;
      for (const column of TEXT_COLUMNS) {
        expect(paramAfter(query!, `${table}."${column}" <>`), column).toBe('');
      }
      expect(query!.sql).toContain(`cardinality(${table}."taglines") >= 1`);
      expect(query!.sql).toContain(`array_position(${table}."taglines", ''::text) is null`);
      expect(query!.sql).toContain(`array_position(${table}."taglines", null::text) is null`);
    },
  );

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

  it('renvoie null sans ligne servie (absente, supprimée ou fr incomplète)', async () => {
    const { client } = clientDouble([]);

    await expect(new DrizzleProfileRepository(client).findProfile('fr')).resolves.toBeNull();
  });
});
