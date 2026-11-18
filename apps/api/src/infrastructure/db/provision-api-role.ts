import { type LogFn, openSingleConnection } from './migrations-runner.js';

export interface ProvisionApiRoleOptions {
  /** URL de la base, avec le rôle propriétaire (celui des migrations). */
  databaseUrl: string;
  /** Nom du rôle de lecture que l'API utilise en production. */
  roleName: string;
  /** Mot de passe du rôle (hexadécimal en production : `openssl rand -hex 24`). */
  password: string;
  log: LogFn;
}

const ROLE_NAME_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Crée (ou met à jour) le rôle PostgreSQL de lecture seule de l'API : `login`, ni superutilisateur,
 * ni création de base ou de rôle, `select` sur toutes les tables du schéma `public` (présentes et
 * futures, pour les tables créées par le rôle propriétaire), aucun autre droit. Idempotent : à
 * rejouer après les migrations, à chaque déploiement ; le mot de passe est réaffecté à chaque fois.
 *
 * Si l'API est compromise (injection SQL, exécution de code), elle ne peut alors ni modifier ou
 * supprimer des données, ni créer d'objets, ni exécuter de programme via `copy … program`.
 */
export async function provisionApiRole(options: ProvisionApiRoleOptions): Promise<void> {
  const { roleName, password } = options;
  if (!ROLE_NAME_PATTERN.test(roleName)) {
    throw new Error(`Nom de rôle invalide : ${roleName}.`);
  }
  if (password === '') {
    throw new Error('Mot de passe du rôle de l’API vide.');
  }
  // Le nom est validé ci-dessus (lettres minuscules, chiffres, `_`) : il peut s'insérer tel quel
  // comme identifiant. Le mot de passe, lui, est quoté côté serveur par `format('%L')`.
  const role = `"${roleName}"`;
  const sql = openSingleConnection(options.databaseUrl);
  try {
    const [existing] = await sql<{ present: boolean }[]>`
      select exists (select 1 from pg_roles where rolname = ${roleName}) as present`;
    const present = existing?.present === true;
    const [definition] = await sql<{ statement: string }[]>`
      select format(
        '%s role %I login nosuperuser nocreatedb nocreaterole noinherit noreplication password %L',
        ${present ? 'alter' : 'create'}::text, ${roleName}::text, ${password}::text
      ) as statement`;
    await sql.unsafe(definition?.statement ?? '');

    const [database] = await sql<
      { name: string }[]
    >`select format('%I', current_database()) as name`;
    await sql.unsafe(`grant connect on database ${database?.name ?? ''} to ${role}`);
    await sql.unsafe(`grant usage on schema public to ${role}`);
    await sql.unsafe(`grant select on all tables in schema public to ${role}`);
    await sql.unsafe(`alter default privileges in schema public grant select on tables to ${role}`);
    options.log(
      `rôle ${roleName} : ${present ? 'mis à jour' : 'créé'}, select seul sur le schéma public`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
