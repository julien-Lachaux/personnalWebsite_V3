import { purgeDeletedEntities } from '../infrastructure/db/deleted-entities.js';
import { parsePurgeArguments } from './deleted-purge-arguments.js';
import { databaseUrl, log, runCli } from './paths.js';

await runCli(async () => {
  const { olderThanDays, confirm } = parsePurgeArguments(process.argv.slice(2));
  await purgeDeletedEntities({ databaseUrl: databaseUrl(), olderThanDays, confirm, log });
});
