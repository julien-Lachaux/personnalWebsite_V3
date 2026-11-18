import { describe, expect, it } from 'vitest';

import { ProjectSchema } from './projects.js';

const valid = {
  slug: 'projet',
  url: 'https://example.com',
  repoUrl: 'https://github.com/example/projet',
  imageDesktop: { path: '/images/d.webp', alt: 'Bureau' },
  imageMobile: null,
  year: 2026,
  title: 'Projet',
  description: 'Description.',
  skills: [],
};

describe('ProjectSchema', () => {
  it('accepte un projet, image mobile nulle comprise', () => {
    expect(ProjectSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte des URL nulles (projet sans site ou sans dépôt public)', () => {
    expect(ProjectSchema.safeParse({ ...valid, url: null, repoUrl: null }).success).toBe(true);
  });

  it('refuse une année non entière et une URL invalide', () => {
    expect(ProjectSchema.safeParse({ ...valid, year: 2026.5 }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...valid, url: 'example' }).success).toBe(false);
  });
});
