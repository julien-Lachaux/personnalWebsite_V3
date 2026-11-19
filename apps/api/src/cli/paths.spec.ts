import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { databaseUrl, log, migrationsDirectory, runCli, seedsDirectory } from './paths.js';

describe('paths (CLI)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('pointe migrations et seeds sur db/ à la racine du dépôt', () => {
    const repositoryRoot = resolve(import.meta.dirname, '../../../..');

    expect(migrationsDirectory).toBe(resolve(repositoryRoot, 'db/migrations'));
    expect(seedsDirectory).toBe(resolve(repositoryRoot, 'db/seeds'));
    expect(existsSync(migrationsDirectory)).toBe(true);
    expect(existsSync(seedsDirectory)).toBe(true);
  });

  it('log écrit une ligne terminée sur la sortie standard', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    log('0001_enums : appliquée');

    expect(write).toHaveBeenCalledWith('0001_enums : appliquée\n');
  });

  it('databaseUrl lit DATABASE_URL dans l’environnement validé', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5432/db');
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:3001');

    expect(databaseUrl()).toBe('postgres://u:p@localhost:5432/db');
  });

  it('databaseUrl refuse un environnement invalide avec le message de la configuration', () => {
    vi.stubEnv('DATABASE_URL', 'mysql://u:p@localhost/db');
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:3001');

    expect(() => databaseUrl()).toThrow(/Configuration d'environnement invalide/);
  });

  describe('runCli', () => {
    it('exécute la tâche et laisse le code de sortie intact', async () => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const task = vi.fn(() => Promise.resolve());

      await runCli(task);

      expect(task).toHaveBeenCalledOnce();
      expect(stderr).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    it('affiche le message d’une Error sur stderr, sans sa pile, et sort en code 1', async () => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      await runCli(() => Promise.reject(new Error('Migrations en attente')));

      expect(stderr).toHaveBeenCalledWith('Erreur : Migrations en attente\n');
      expect(stderr.mock.calls.join('')).not.toContain('at ');
      expect(process.exitCode).toBe(1);
    });

    it('affiche une valeur levée qui n’est pas une Error sous sa forme texte', async () => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- c'est le cas testé
      await runCli(() => Promise.reject('panne brute'));

      expect(stderr).toHaveBeenCalledWith('Erreur : panne brute\n');
      expect(process.exitCode).toBe(1);
    });
  });
});
