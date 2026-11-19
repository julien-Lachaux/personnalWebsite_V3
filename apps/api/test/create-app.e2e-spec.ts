import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/infrastructure/http/create-app.js';

/**
 * `createApp()` tel que `main.ts` l'appelle, sans option : les autres e2e passent `logger: false`
 * (voir `support/test-app.ts`), ce cas vérifie la journalisation par défaut de la production.
 */
describe('createApp sans option', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('journalise error, warn et log, mais ni debug ni verbose', async () => {
    // Le logger Nest par défaut écrit le démarrage des modules sur stdout : capté, pas affiché.
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const app = await createApp();
    try {
      expect(Logger.isLevelEnabled('error')).toBe(true);
      expect(Logger.isLevelEnabled('warn')).toBe(true);
      expect(Logger.isLevelEnabled('log')).toBe(true);
      expect(Logger.isLevelEnabled('debug')).toBe(false);
      expect(Logger.isLevelEnabled('verbose')).toBe(false);
      expect(stdout.mock.calls.join('')).toContain('Starting Nest application');
    } finally {
      await app.close();
    }
  });
});
