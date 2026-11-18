import { runMigrations } from '../infrastructure/db/migrations-runner.js';
import { databaseUrl, log, migrationsDirectory, runCli } from './paths.js';

await runCli(async () => {
  await runMigrations({ databaseUrl: databaseUrl(), directory: migrationsDirectory, log });
});
