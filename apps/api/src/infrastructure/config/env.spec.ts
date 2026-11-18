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

  it("refuse une DATABASE_URL qui n'est pas PostgreSQL", () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('refuse une configuration sans CORS_ORIGIN', () => {
    expect(() => loadEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/CORS_ORIGIN/);
  });
});
