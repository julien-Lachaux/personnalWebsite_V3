// Pages d'erreur serveur statiques du site généré (lot 30) : une page par langue, servie par le proxy
// (Caddy) à la place d'une réponse 500, 502, 503 ou 504, avec ce statut. Module pur, lu par
// nuxt.config.ts (prérendu) et par error.vue (contenu de la page).
//
// Quand elle est servie, le serveur ou l'API peuvent être en panne : la page ne dépend de rien d'autre
// que des feuilles de style et des polices du site. Elle est rendue au prérendu comme les pages 404
// (le routeur n'y trouve aucune page et rend error.vue, qui reconnaît son adresse), puis nuxt.config.ts
// en retire l'application (`standaloneErrorPage`) : ni module, ni carte d'import, ni charge utile, ni
// configuration. Seul le script de thème sans flash (D5) reste : en ligne, haché dans la CSP, il ne lit
// que le stockage local et les préférences du système, et applique les réglages enregistrés (thème,
// contraste, taille du texte…) ; sans JavaScript, la page suit `prefers-color-scheme` (tokens.css).
// Sans application, la page n'est pas hydratée : servie à n'importe quelle adresse, elle reste telle
// qu'elle a été rendue.

/** Pages d'erreur serveur à prérendre, une par langue (fr sans préfixe, en sous `/en`). */
export const SERVER_ERROR_PAGES: readonly string[] = ['/50x.html', '/en/50x.html'];

/** Vrai pour l'adresse de rendu d'une page d'erreur serveur. */
export function isServerErrorPage(path: string): boolean {
  return SERVER_ERROR_PAGES.includes(path);
}

const SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const LINK = /<link\b[^>]*>/gi;
const ATTRIBUTE = /\s([\w-]+)="([^"]*)"/g;

/** Attributs d'une balise (valeurs entre guillemets doubles, comme les écrit le rendu de Nuxt). */
function attributesOf(tag: string): Map<string, string> {
  return new Map([...tag.matchAll(ATTRIBUTE)].map((match) => [match[1]!, match[2]!]));
}

/** Vrai pour un lien qui précharge l'application : module, script ou charge utile. */
export function isApplicationHint(link: string): boolean {
  const attributes = attributesOf(link);
  const rel = attributes.get('rel');
  const as = attributes.get('as');
  if (rel === 'modulepreload') return true;
  return (rel === 'preload' || rel === 'prefetch') && (as === 'script' || as === 'fetch');
}

/**
 * Document HTML d'une page d'erreur serveur sans l'application de Nuxt : tout `<script>` est retiré
 * (modules, carte d'import, configuration `window.__NUXT__`, charge utile JSON), sauf celui dont le
 * contenu est exactement `keptScript` (le script de thème), ainsi que les liens qui préchargent un
 * module, un script ou une charge utile. Feuilles de style, styles en ligne et préchargement des
 * polices restent.
 */
export function standaloneErrorPage(html: string, keptScript: string): string {
  return html
    .replace(SCRIPT, (element, content: string) => (content === keptScript ? element : ''))
    .replace(LINK, (link) => (isApplicationHint(link) ? '' : link));
}
