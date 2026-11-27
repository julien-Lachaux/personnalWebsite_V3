// Environnement hermétique des tests qui lancent git (lot 49) : aucun askpass (graphique ou non),
// aucune configuration git de l'utilisateur, aucun affichage. `GIT_TERMINAL_PROMPT=0` ne coupe que
// le prompt du terminal : sans les autres variables, git retombe sur `SSH_ASKPASS` de l'utilisateur
// (ksshaskpass sous KDE) et ouvre une fenêtre qui bloque le test.
//
// Les variables askpass et d'affichage sont verrouillées : un `overrides` ne peut pas les remettre.
// `/bin/false` est l'askpass neutre : il échoue, git sort aussitôt avec le code 128 (« could not read
// Username »), sans fenêtre. `/bin/true` ne convient pas : git accepte alors des identifiants vides et sort avec 0.

/** Délai maximal d'un appel git de test, en millisecondes. */
export const GIT_TIMEOUT_MS = 5000;

/** Options à passer à spawnSync / execFileSync : délai borné et arrêt du processus au dépassement. */
export const GIT_SPAWN_LIMITS = { timeout: GIT_TIMEOUT_MS, killSignal: 'SIGKILL' };

const LOCKED = ['GIT_ASKPASS', 'SSH_ASKPASS'];
const REMOVED = ['DISPLAY', 'WAYLAND_DISPLAY', 'SSH_ASKPASS_REQUIRE'];

/**
 * @param {NodeJS.ProcessEnv} [overrides] surcharges légitimes (HOME, GIT_CONFIG_PARAMETERS…), sauf
 *   GIT_ASKPASS, SSH_ASKPASS, DISPLAY, WAYLAND_DISPLAY et SSH_ASKPASS_REQUIRE, toujours neutralisées
 * @returns {NodeJS.ProcessEnv} nouvel objet ; process.env n'est pas modifié
 */
export function hermeticGitEnv(overrides = {}) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    ...overrides,
  };
  for (const name of LOCKED) env[name] = '/bin/false';
  for (const name of REMOVED) delete env[name];
  return env;
}
