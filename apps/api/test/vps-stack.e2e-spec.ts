import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Variante VPS (lot 29, L29-05) rejouée contre sa pile d'essai (`bash scripts/deploy/vps-stack.sh up`) :
 * Caddy de l'hôte simulé -> socket Unix -> Caddy de la pile -> API (TRUST_PROXY=uniquelocal), deux clients
 * d'adresses distinctes. Même détection que local-stack.e2e-spec.ts : sans pile, un test unique le consigne ;
 * VPS_STACK_REQUIRED=1 (CI) fait échouer son absence.
 */
const script = fileURLToPath(new URL('../../../scripts/deploy/vps-stack.sh', import.meta.url));
const envFile =
  process.env['VPS_STACK_ENV_FILE'] ??
  fileURLToPath(new URL('../../../docker/.env.vps-test', import.meta.url));
const required = process.env['VPS_STACK_REQUIRED'] === '1';

function stack(args: string[]) {
  return spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PODMAN_COMPOSE_WARNING_LOGS: 'false' },
  });
}

/** Statut HTTP d'une requête faite depuis le conteneur client (wget, en-têtes sur stderr). */
function status(client: string, headers: string[] = []): number {
  const extra = headers.map((header) => `--header '${header}'`).join(' ');
  const result = stack([
    'exec',
    client,
    'sh',
    '-c',
    `wget -q -S -O /dev/null ${extra} http://frontal:8080/api/v1/health 2>&1 | grep -o 'HTTP/1.1 [0-9]*' | head -n 1`,
  ]);
  return Number(/HTTP\/1\.1 (\d+)/.exec(result.stdout)?.[1] ?? '0');
}

function address(client: string): string {
  return stack(['exec', client, 'hostname', '-i']).stdout.trim();
}

const available =
  existsSync(envFile) && stack(['exec', 'client-a', 'true']).status === 0 && status('client-a') > 0;

if (!available) {
  describe('pile de la variante VPS (absente)', () => {
    it(
      required
        ? 'la pile VPS est attendue (VPS_STACK_REQUIRED=1) mais ne répond pas : lancer `bash scripts/deploy/vps-stack.sh up`'
        : 'pile VPS non démarrée : scénarios non rejoués (`bash scripts/deploy/vps-stack.sh up` pour les jouer)',
      () => {
        expect(required, `pile injoignable via ${envFile}`).toBe(false);
      },
    );
  });
} else {
  describe('variante VPS : IP réelle des clients derrière deux Caddy', () => {
    it('sépare le quota de deux clients et ignore un X-Forwarded-For fourni par le client', async () => {
      // Fenêtre de la pile d'essai : 5 s, 5 requêtes (RATE_LIMIT_* de l'environnement généré).
      await new Promise((resolve) => setTimeout(resolve, 6000));
      const results: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        results.push(status('client-a'));
      }

      expect(results.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(results.slice(5)).toEqual([429, 429]);
      // Un autre client garde son quota entier, même s'il prétend être le premier.
      expect(status('client-b')).toBe(200);
      expect(status('client-b', [`X-Forwarded-For: ${address('client-a')}`])).toBe(200);
    }, 60_000);

    it('journalise l’adresse de chaque client (et non celle du frontal) dans le Caddy de la pile', () => {
      const logs = stack(['logs', 'caddy']).stdout;
      const clients = [address('client-a'), address('client-b')];

      expect(clients[0]).not.toBe(clients[1]);
      for (const client of clients) {
        expect(logs, client).toContain(`"client_ip":"${client}"`);
      }
    });

    it('ne publie aucun port de l’hôte', () => {
      const ps = stack(['ps']).stdout;

      expect(ps).not.toMatch(/0\.0\.0\.0:\d+->/);
    });
  });
}
