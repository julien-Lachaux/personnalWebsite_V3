import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgres://user:secret@localhost:5432/siteperso',
  CORS_ORIGIN: 'http://localhost:3001, https://example.test',
};

describe('loadEnv', () => {
  it('applique les valeurs par défaut et découpe CORS_ORIGIN', () => {
    const env = loadEnv(valid);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3001', 'https://example.test']);
  });

  it('convertit PORT en nombre', () => {
    expect(loadEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('fixe le rate limiting à 100 requêtes par minute par défaut, sans proxy de confiance', () => {
    const env = loadEnv(valid);
    expect(env.RATE_LIMIT_MAX).toBe(100);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(60_000);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it('lit le seuil, la fenêtre et TRUST_PROXY depuis l’environnement', () => {
    const env = loadEnv({
      ...valid,
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_WINDOW_MS: '1000',
      TRUST_PROXY: 'true',
    });
    expect(env.RATE_LIMIT_MAX).toBe(5);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(1000);
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('refuse un seuil de rate limiting nul ou une fenêtre trop courte', () => {
    expect(() => loadEnv({ ...valid, RATE_LIMIT_MAX: '0' })).toThrow(/RATE_LIMIT_MAX/);
    expect(() => loadEnv({ ...valid, RATE_LIMIT_WINDOW_MS: '10' })).toThrow(/RATE_LIMIT_WINDOW_MS/);
    expect(() => loadEnv({ ...valid, TRUST_PROXY: 'oui' })).toThrow(/TRUST_PROXY/);
  });

  it("refuse une DATABASE_URL qui n'est pas PostgreSQL", () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('refuse une configuration sans CORS_ORIGIN', () => {
    expect(() => loadEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/CORS_ORIGIN/);
  });
});
