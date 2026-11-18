import { describe, expect, it } from 'vitest';

import { SocialLinkSchema } from './social-links.js';

const valid = {
  slug: 'github',
  kind: 'github',
  url: 'https://github.com/example',
  label: 'GitHub',
};

describe('SocialLinkSchema', () => {
  it('accepte un lien valide', () => {
    expect(SocialLinkSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse une URL invalide et une clé inconnue', () => {
    expect(SocialLinkSchema.safeParse({ ...valid, url: 'github' }).success).toBe(false);
    expect(SocialLinkSchema.safeParse({ ...valid, id: 1 }).success).toBe(false);
  });
});
