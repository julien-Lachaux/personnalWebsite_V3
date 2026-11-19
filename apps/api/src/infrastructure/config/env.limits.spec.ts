import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgres://user:secret@localhost:5432/siteperso',
  CORS_ORIGIN: 'http://localhost:3001',
};

describe('loadEnv : bornes et formes acceptées', () => {
  it.each(['development', 'test', 'production'])('accepte NODE_ENV=%s', (nodeEnv) => {
    expect(loadEnv({ ...valid, NODE_ENV: nodeEnv }).NODE_ENV).toBe(nodeEnv);
  });

  it.each(['staging', '', 'Production'])('refuse NODE_ENV=%j', (nodeEnv) => {
    expect(() => loadEnv({ ...valid, NODE_ENV: nodeEnv })).toThrow(/NODE_ENV/);
  });

  it('accepte un HOST non vide et refuse un HOST vide', () => {
    expect(loadEnv({ ...valid, HOST: 'localhost' }).HOST).toBe('localhost');
    expect(() => loadEnv({ ...valid, HOST: '' })).toThrow(/HOST/);
  });

  it.each(['postgres://localhost/db', 'postgresql://localhost/db'])('accepte %s', (url) => {
    expect(loadEnv({ ...valid, DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it.each([
    'postgresx://localhost/db',
    'postgresqlx://localhost/db',
    'xpostgres://localhost/db',
    'mypostgresql://localhost/db',
  ])('refuse le protocole voisin de %s', (url) => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: url })).toThrow(/DATABASE_URL/);
  });

  it('borne DB_STATEMENT_TIMEOUT_MS à 100 ms au minimum, sans maximum', () => {
    expect(loadEnv({ ...valid, DB_STATEMENT_TIMEOUT_MS: '100' }).DB_STATEMENT_TIMEOUT_MS).toBe(100);
    expect(loadEnv({ ...valid, DB_STATEMENT_TIMEOUT_MS: '60000' }).DB_STATEMENT_TIMEOUT_MS).toBe(
      60_000,
    );
    expect(() => loadEnv({ ...valid, DB_STATEMENT_TIMEOUT_MS: '99' })).toThrow(
      /DB_STATEMENT_TIMEOUT_MS/,
    );
  });

  it('borne HANDLER_TIMEOUT_MS à 100 ms au minimum, sans maximum', () => {
    expect(loadEnv({ ...valid, HANDLER_TIMEOUT_MS: '100' }).HANDLER_TIMEOUT_MS).toBe(100);
    expect(loadEnv({ ...valid, HANDLER_TIMEOUT_MS: '60000' }).HANDLER_TIMEOUT_MS).toBe(60_000);
  });

  it('borne PORT entre 1 et 65535', () => {
    expect(loadEnv({ ...valid, PORT: '1' }).PORT).toBe(1);
    expect(loadEnv({ ...valid, PORT: '65535' }).PORT).toBe(65_535);
    expect(() => loadEnv({ ...valid, PORT: '0' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...valid, PORT: '65536' })).toThrow(/PORT/);
  });
});

describe('loadEnv : CORS_ORIGIN', () => {
  it('ignore les entrées vides ou faites d’espaces (virgule finale, double virgule)', () => {
    const env = loadEnv({
      ...valid,
      CORS_ORIGIN: 'http://localhost:3001,, ,https://example.test,',
    });

    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3001', 'https://example.test']);
  });

  it('refuse une liste qui ne contient aucune origine', () => {
    expect(() => loadEnv({ ...valid, CORS_ORIGIN: ' , ' })).toThrow(/CORS_ORIGIN/);
  });

  it('refuse une origine qui n’est pas une URL', () => {
    expect(() => loadEnv({ ...valid, CORS_ORIGIN: 'http://localhost:3001,pas-une-url' })).toThrow(
      /CORS_ORIGIN/,
    );
  });
});

describe('loadEnv : TRUST_PROXY', () => {
  it('ignore les espaces autour de la valeur entière', () => {
    expect(loadEnv({ ...valid, TRUST_PROXY: '  false  ' }).TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...valid, TRUST_PROXY: '  loopback, 10.0.0.1  ' }).TRUST_PROXY).toEqual([
      'loopback',
      '10.0.0.1',
    ]);
  });

  it('explique ce qui est attendu quand la valeur est refusée', () => {
    expect(() => loadEnv({ ...valid, TRUST_PROXY: 'true' })).toThrow(
      /attendu : false ou une liste d’IP, de CIDR ou de plages nommées \(loopback, linklocal, uniquelocal\) séparés par des virgules ; « true » est refusé \(il ferait confiance à tous les sauts\) et Fastify 5 refuse un simple nombre de sauts\n\s+→ at TRUST_PROXY/,
    );
  });
});
