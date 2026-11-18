import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { provisionApiRole } from '../../src/infrastructure/db/provision-api-role.js';
import { openTestSql, resetTestDatabase, testDatabaseUrl } from '../support/database.js';

const ROLE = 'siteperso_api_e2e';
const PASSWORD = 'mot-de-passe-d-essai';

/** URL de la base de test avec les identifiants du rôle de lecture seule. */
function apiRoleUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.username = ROLE;
  url.password = PASSWORD;
  return url.toString();
}

describe('rôle PostgreSQL de lecture seule de l’API', () => {
  let owner: Sql;
  let api: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    owner = openTestSql();
    await provisionApiRole({
      databaseUrl: testDatabaseUrl(),
      roleName: ROLE,
      password: PASSWORD,
      log: () => undefined,
    });
    api = postgres(apiRoleUrl(), { max: 1, onnotice: () => undefined });
  });

  afterAll(async () => {
    await api.end({ timeout: 5 });
    await owner.unsafe(`drop owned by ${ROLE}; drop role if exists ${ROLE}`);
    await owner.end({ timeout: 5 });
  });

  it('n’est ni superutilisateur, ni autorisé à créer des bases ou des rôles', async () => {
    const [role] = await owner<{ super: boolean; db: boolean; createrole: boolean }[]>`
      select rolsuper as super, rolcreatedb as db, rolcreaterole as createrole
      from pg_roles where rolname = ${ROLE}`;

    expect(role).toEqual({ super: false, db: false, createrole: false });
  });

  it('a select sur chaque table de contenu et aucun autre droit sur la table profile', async () => {
    const privileges = await owner<{ select: boolean; privilege: string; allowed: boolean }[]>`
      select p.privilege, has_table_privilege(${ROLE}, 'profile', p.privilege) as allowed
      from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])
        as p(privilege)`;

    expect(Object.fromEntries(privileges.map((row) => [row.privilege, row.allowed]))).toEqual({
      SELECT: true,
      INSERT: false,
      UPDATE: false,
      DELETE: false,
      TRUNCATE: false,
      REFERENCES: false,
      TRIGGER: false,
    });
  });

  it('lit le contenu', async () => {
    const rows = await api`select first_name from profile`;

    expect(rows).toHaveLength(1);
  });

  it('refuse toute écriture, toute définition de schéma et tout programme serveur', async () => {
    await expect(api`update profile set first_name = 'x'`).rejects.toThrow(/permission denied/);
    await expect(api`delete from skills`).rejects.toThrow(/permission denied/);
    await expect(api.unsafe('create table t_pirate (id int)')).rejects.toThrow(/permission denied/);
    await expect(api.unsafe('drop table profile cascade')).rejects.toThrow(/must be owner/);
    await expect(api.unsafe("copy (select 1) to program 'id'")).rejects.toThrow(
      /permission denied|superuser/,
    );
  });

  it('couvre aussi les tables créées plus tard par le propriétaire (privilèges par défaut)', async () => {
    await owner.unsafe('create table t_apres (id int)');
    try {
      await expect(api`select * from t_apres`).resolves.toHaveLength(0);
      await expect(api`insert into t_apres values (1)`).rejects.toThrow(/permission denied/);
    } finally {
      await owner.unsafe('drop table t_apres');
    }
  });

  it('est idempotent et réaffecte le mot de passe', async () => {
    await provisionApiRole({
      databaseUrl: testDatabaseUrl(),
      roleName: ROLE,
      password: PASSWORD,
      log: () => undefined,
    });

    await expect(api`select 1 as one`).resolves.toHaveLength(1);
  });

  it('refuse un nom de rôle ou un mot de passe invalide', async () => {
    const options = { databaseUrl: testDatabaseUrl(), log: () => undefined };
    await expect(
      provisionApiRole({ ...options, roleName: 'Mauvais; drop', password: 'x' }),
    ).rejects.toThrow(/Nom de rôle invalide/);
    await expect(provisionApiRole({ ...options, roleName: ROLE, password: '' })).rejects.toThrow(
      /vide/,
    );
  });
});
