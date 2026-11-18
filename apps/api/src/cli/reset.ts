import { resetDatabase } from '../infrastructure/db/reset-database.js';
import { databaseUrl, log, migrationsDirectory, runCli, seedsDirectory } from './paths.js';

await runCli(async () => {
  await resetDatabase({
    databaseUrl: databaseUrl(),
    migrationsDirectory,
    seedsDirectory,
    log,
  });
});
