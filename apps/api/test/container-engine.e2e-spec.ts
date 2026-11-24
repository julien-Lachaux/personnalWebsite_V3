import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Choix du moteur de conteneurs (scripts/container-engine.sh) et branches podman de la pile locale
 * (scripts/deploy/local-stack.sh), exécutés pour de vrai avec un PATH réduit : des `podman`, `docker`
 * et `curl` factices qui notent leurs appels, et les seuls outils système dont les scripts ont besoin.
 * Aucun conteneur n'est lancé.
 */

const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const engineScript = root('scripts/container-engine.sh');
const stackScript = root('scripts/deploy/local-stack.sh');

/** Outils système appelés par les scripts, liés depuis l'hôte dans le dossier du PATH réduit. */
const SYSTEM_TOOLS = [
  'bash',
  'sed',
  'tail',
  'head',
  'od',
  'tr',
  'dirname',
  'basename',
  'grep',
  'cat',
];

function hostPath(tool: string): string {
  for (const directory of (process.env['PATH'] ?? '').split(delimiter)) {
    const candidate = join(directory, tool);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`outil introuvable sur l'hôte : ${tool}`);
}

let bin: string;
let callLog: string;
let workdir: string;
const bash = hostPath('bash');

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'siteperso-engine-'));
  bin = join(workdir, 'bin');
  callLog = join(workdir, 'appels.log');
  spawnSync('mkdir', [bin]);
  for (const tool of SYSTEM_TOOLS) {
    symlinkSync(hostPath(tool), join(bin, tool));
  }
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

/** Commande factice : note `nom arguments` dans le journal, affiche `version` à `--version`. */
function fake(name: string, version = `${name} version 0.0.0`): void {
  const file = join(bin, name);
  writeFileSync(
    file,
    [
      `#!${bash}`,
      `if [ "$1" = "--version" ]; then echo "${version}"; exit 0; fi`,
      `printf '%s\\n' "${name} $*" >> "${callLog}"`,
      'exit 0',
      '',
    ].join('\n'),
  );
  chmodSync(file, 0o755);
}

function calls(): string[] {
  return existsSync(callLog) ? readFileSync(callLog, 'utf8').trim().split('\n') : [];
}

// Entrée standard fermée, obligatoire : Node relie celle de l'enfant par une socket, et un bash compilé
// pour les shells distants (Fedora) lit alors ~/.bashrc, /etc/bashrc et /etc/profile.d même en mode non
// interactif. Avec le PATH réduit, une commande introuvable y déclenche le command_not_found_handle de
// PackageKit, qui appelle `gettext`, introuvable aussi, dans un nouveau sous-shell : la récursion lance
// des milliers de bash jusqu'à épuiser la mémoire.
const STDIO = ['ignore', 'pipe', 'pipe'] as const;

function engine(env: Record<string, string> = {}) {
  return spawnSync(bash, ['-c', `source "${engineScript}" && container_engine`], {
    encoding: 'utf8',
    stdio: [...STDIO],
    env: { PATH: bin, ...env },
  });
}

function stack(args: string[], env: Record<string, string> = {}) {
  return spawnSync(bash, [stackScript, ...args], {
    encoding: 'utf8',
    stdio: [...STDIO],
    env: {
      PATH: bin,
      STACK_ENV_FILE: join(workdir, '.env.local'),
      STACK_WAIT_SECONDS: '5',
      ...env,
    },
  });
}

describe('scripts/container-engine.sh : choix du moteur', () => {
  it('prend docker s’il est installé, sinon podman', () => {
    fake('podman');
    expect(engine().stdout.trim()).toBe('podman');

    fake('docker', 'Docker version 27.0.0');
    expect(engine().stdout.trim()).toBe('docker');
  });

  it('respecte CONTAINER_ENGINE', () => {
    fake('docker', 'Docker version 27.0.0');
    fake('podman');

    expect(engine({ CONTAINER_ENGINE: 'podman' }).stdout.trim()).toBe('podman');
  });

  it('refuse une valeur invalide de CONTAINER_ENGINE', () => {
    fake('docker', 'Docker version 27.0.0');
    const result = engine({ CONTAINER_ENGINE: 'lxc' });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('CONTAINER_ENGINE invalide : lxc');
  });

  it('refuse un moteur imposé mais absent, et l’absence de tout moteur', () => {
    const none = engine();
    expect(none.status).toBe(1);
    expect(none.stderr).toContain("ni podman ni docker n'est installé");

    fake('docker', 'Docker version 27.0.0');
    const missing = engine({ CONTAINER_ENGINE: 'podman' });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('podman est introuvable');
  });

  it('compte pour podman une commande docker qui est podman (podman-docker)', () => {
    fake('docker', 'podman version 6.2.0');
    fake('podman');

    expect(engine().stdout.trim()).toBe('podman');
  });
});

describe('scripts/deploy/local-stack.sh : branches du moteur', () => {
  it('sous podman : surcharge compose.podman.yml et image du front par podman build --ignorefile', () => {
    fake('podman');
    fake('curl');
    const result = stack(['up'], { CONTAINER_ENGINE: 'podman' });

    expect(result.status, result.stderr).toBe(0);
    const log = calls();
    const composeUp = log.find((line) => / compose .* up -d --build$/.test(line));
    expect(composeUp).toContain(`-f ${root('docker/compose.prod.yml')}`);
    expect(composeUp).toContain(`-f ${root('docker/compose.podman.yml')}`);
    expect(log).toContain(
      `podman build --file ${root('docker/web.Dockerfile')} ` +
        `--ignorefile ${root('docker/web.Dockerfile.dockerignore')} ` +
        `--tag siteperso-web-build:prod ${root('').replace(/\/$/, '')}`,
    );
    expect(log.some((line) => line.includes('compose') && line.endsWith(' build web-build'))).toBe(
      false,
    );
    expect(log.some((line) => line.endsWith(' run --rm web-build'))).toBe(true);
  });

  it('sous docker : ni surcharge podman ni podman build', () => {
    fake('docker', 'Docker version 27.0.0');
    fake('curl');
    const result = stack(['up'], { CONTAINER_ENGINE: 'docker' });

    expect(result.status, result.stderr).toBe(0);
    const log = calls();
    expect(log.some((line) => line.includes('compose.podman.yml'))).toBe(false);
    expect(log.some((line) => line.startsWith('podman '))).toBe(false);
    expect(
      log.some((line) => line.startsWith('docker compose') && line.endsWith(' build web-build')),
    ).toBe(true);
  });
});
