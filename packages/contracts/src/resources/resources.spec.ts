import { describe, expect, it } from 'vitest';

import { ResourceSchema } from './resources.js';

const valid = {
  slug: 'ressource',
  url: 'https://example.com',
  groupSlug: null,
  picture: null,
  name: 'Ressource',
  description: 'Description.',
};

describe('ResourceSchema', () => {
  it('accepte une ressource sans groupe ni visuel', () => {
    expect(ResourceSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte un groupe et un visuel renseignés', () => {
    const full = { ...valid, groupSlug: 'langages', picture: { path: '/a.webp', alt: 'Visuel' } };
    expect(ResourceSchema.safeParse(full).success).toBe(true);
  });

  it('refuse un groupSlug invalide', () => {
    expect(ResourceSchema.safeParse({ ...valid, groupSlug: 'Langages' }).success).toBe(false);
  });
});
