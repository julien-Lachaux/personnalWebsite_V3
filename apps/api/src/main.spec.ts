import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_CONFIG } from './infrastructure/config/config.module.js';
import { GLOBAL_PREFIX } from './infrastructure/http/create-app.js';
import type * as CreateAppModule from './infrastructure/http/create-app.js';

const { createApp, app } = vi.hoisted(() => {
  const app = {
    get: vi.fn(() => ({ PORT: 3210, HOST: '127.0.0.1' })),
    listen: vi.fn(() => Promise.resolve()),
  };
  return { createApp: vi.fn(() => Promise.resolve(app)), app };
});

vi.mock('./infrastructure/http/create-app.js', async (importOriginal) => ({
  ...(await importOriginal<typeof CreateAppModule>()),
  createApp,
}));

describe('main (point d’entrée)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('construit l’application, écoute sur PORT et HOST de la configuration et l’annonce', async () => {
    const log = vi.spyOn(Logger, 'log').mockImplementation(() => undefined);

    await import('./main.js');

    expect(createApp).toHaveBeenCalledOnce();
    expect(app.get).toHaveBeenCalledWith(APP_CONFIG);
    expect(app.listen).toHaveBeenCalledWith({ port: 3210, host: '127.0.0.1' });
    expect(log).toHaveBeenCalledWith(
      `API démarrée sur http://127.0.0.1:3210/${GLOBAL_PREFIX}`,
      'Bootstrap',
    );
  });
});
