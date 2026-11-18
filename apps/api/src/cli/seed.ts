import { runSeeds } from '../infrastructure/db/seeds-runner.js';
import { databaseUrl, log, migrationsDirectory, runCli, seedsDirectory } from './paths.js';

await runCli(async () => {
  await runSeeds({
    databaseUrl: databaseUrl(),
    directory: seedsDirectory,
    migrationsDirectory,
    log,
  });
});
