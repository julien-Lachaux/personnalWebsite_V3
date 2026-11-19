import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as PathsModule from './paths.js';

const { provisionApiRole } = vi.hoisted(() => ({ provisionApiRole: vi.fn() }));

vi.mock('../infrastructure/db/provision-api-role.js', () => ({ provisionApiRole }));
vi.mock('./paths.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PathsModule>()),
  databaseUrl: () => 'postgres://u:p@localhost:5432/db',
  log: vi.fn(),
}));

describe('cli/provision-api-role', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    provisionApiRole.mockReset();
    process.exitCode = undefined;
  });

  it('provisionne le rôle siteperso_api par défaut avec le mot de passe de l’environnement', async () => {
    vi.stubEnv('API_DB_PASSWORD', 'secret-d-essai');
    vi.stubEnv('API_DB_USER', undefined);
    provisionApiRole.mockResolvedValue(undefined);

    await import('./provision-api-role.js');

    expect(provisionApiRole).toHaveBeenCalledWith({
      databaseUrl: 'postgres://u:p@localhost:5432/db',
      roleName: 'siteperso_api',
      password: 'secret-d-essai',
      log: expect.any(Function) as unknown,
    });
    expect(process.exitCode).toBeUndefined();
  });

  it('prend le nom de rôle d’API_DB_USER quand il est fourni', async () => {
    vi.stubEnv('API_DB_PASSWORD', 'secret-d-essai');
    vi.stubEnv('API_DB_USER', 'lecteur_api');
    provisionApiRole.mockResolvedValue(undefined);

    await import('./provision-api-role.js');

    expect(provisionApiRole).toHaveBeenCalledWith(
      expect.objectContaining({ roleName: 'lecteur_api' }),
    );
  });

  it.each([
    ['absent', undefined],
    ['vide', ''],
  ])('refuse un API_DB_PASSWORD %s sans toucher à la base', async (_label, password) => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.stubEnv('API_DB_PASSWORD', password);

    await import('./provision-api-role.js');

    expect(provisionApiRole).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'Erreur : API_DB_PASSWORD est requis (mot de passe du rôle de lecture seule de l’API).\n',
    );
    expect(process.exitCode).toBe(1);
  });
});
