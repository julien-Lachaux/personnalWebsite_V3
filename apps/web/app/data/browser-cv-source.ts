// Source du CV du navigateur dans le site généré (lot F11, F11-01). Le CV est lu à la génération
// (`nuxt generate`) et rangé dans la charge utile de chaque page : dans le navigateur, `useAsyncData`
// le trouve là et n'appelle jamais le gestionnaire de `fetch-cv.ts`. Le build client de `nuxt generate`
// remplace donc `select-cv-source.ts` par ce module (greffon Vite de `nuxt.config.ts`) : ni les schémas
// Zod des contrats, ni la lecture de l'API, ni les fixtures ne sont publiés dans `_nuxt/`. Si le
// gestionnaire s'exécutait quand même (charge utile absente), la lecture échoue avec ce message, comme
// elle échouait déjà sans la configuration privée (absente du navigateur), jamais par un repli.
import { CvSourceError } from './cv-source.js';
import type { createCvSource as CreateCvSource } from './select-cv-source.js';

/** Message de l'échec : le navigateur ne lit jamais la source du CV. */
export const BROWSER_CV_SOURCE_MESSAGE =
  "Le CV n'est lu qu'à la génération du site : dans le navigateur, il vient de la charge utile de la page";

/** Même signature que `createCvSource` de `select-cv-source.ts`, qu'il remplace dans le navigateur. */
export const createCvSource: typeof CreateCvSource = () => {
  throw new CvSourceError('config', BROWSER_CV_SOURCE_MESSAGE);
};
