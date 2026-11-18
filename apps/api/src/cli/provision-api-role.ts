import { provisionApiRole } from '../infrastructure/db/provision-api-role.js';
import { databaseUrl, log, runCli } from './paths.js';

/** Nom du rôle de lecture seule de l'API (`API_DB_USER` pour en changer). */
const DEFAULT_ROLE_NAME = 'siteperso_api';

await runCli(async () => {
  const password = process.env['API_DB_PASSWORD'];
  if (password === undefined || password === '') {
    throw new Error('API_DB_PASSWORD est requis (mot de passe du rôle de lecture seule de l’API).');
  }
  await provisionApiRole({
    databaseUrl: databaseUrl(),
    roleName: process.env['API_DB_USER'] ?? DEFAULT_ROLE_NAME,
    password,
    log,
  });
});
