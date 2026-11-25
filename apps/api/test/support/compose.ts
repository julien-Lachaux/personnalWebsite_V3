import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Lanceur compose du dépôt : podman ou docker, choisi par scripts/container-engine.sh. */
const composeScript = fileURLToPath(new URL('../../../../scripts/compose.sh', import.meta.url));

/** `<moteur> compose <args>` (scripts/compose.sh), pour les tests qui lisent ou pilotent une pile. */
export function runCompose(
  args: string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string> {
  return spawnSync('bash', [composeScript, ...args], options);
}
