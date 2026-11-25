import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../../docker/caddy-start.sh', import.meta.url));

/**
 * Point d'entrée du Caddy de la pile (lot 32, revue de la PR #25) : les valeurs injectées telles quelles dans
 * la configuration (docker/wip.caddy) sont validées avant de lancer Caddy. Chaque cas refusé s'arrête avant
 * `exec caddy` : aucun Caddy n'est nécessaire, aucun conteneur n'est lancé.
 */
describe('caddy-start.sh : refus des valeurs du mode travaux injectées dans la configuration', () => {
  function start(env: Record<string, string>) {
    return spawnSync('sh', [script], {
      encoding: 'utf8',
      // stdin fermé : aucun shell ne lit d'entrée héritée.
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env['PATH'] ?? '/usr/bin:/bin', WIP_MODE: 'off', ...env },
    });
  }

  it.each([
    ['statut non numérique', { WIP_STATUS: 'abc' }, 'WIP_STATUS'],
    ['statut à deux chiffres', { WIP_STATUS: '50' }, 'WIP_STATUS'],
    ['statut avec guillemet', { WIP_STATUS: '503"' }, 'WIP_STATUS'],
    ['statut hors des classes HTTP', { WIP_STATUS: '603' }, 'WIP_STATUS'],
    ['Retry-After non numérique', { WIP_RETRY_AFTER: '1h' }, 'WIP_RETRY_AFTER'],
    ['Retry-After avec saut de ligne', { WIP_RETRY_AFTER: '3600\nx' }, 'WIP_RETRY_AFTER'],
  ])('refuse : %s', (_case, env, variable) => {
    const result = start(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`ERREUR : ${variable}`);
  });
});
