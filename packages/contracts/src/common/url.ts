import { z } from 'zod';

/**
 * Adresse web publique : `http` ou `https` uniquement. `z.url()` seul accepterait `javascript:`,
 * `data:`, `mailto:` ou `tel:`, que le front rendrait dans un `href` (XSS stockée). Le contact
 * reste géré par le front (docs/01) : pas de `mailto:` ni de `tel:` dans l'API.
 */
export const HttpUrlSchema = z.url({ protocol: /^https?$/ });
