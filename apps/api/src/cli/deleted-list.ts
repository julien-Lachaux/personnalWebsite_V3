import { listDeletedEntities } from '../infrastructure/db/deleted-entities.js';
import { databaseUrl, log, runCli } from './paths.js';

await runCli(async () => {
  await listDeletedEntities({ databaseUrl: databaseUrl(), log });
});
