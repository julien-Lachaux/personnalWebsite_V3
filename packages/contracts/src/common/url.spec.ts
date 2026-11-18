import { describe, expect, it } from 'vitest';

import { CertificationSchema } from '../certifications/certifications.js';
import { EducationSchema } from '../education/education.js';
import { ExperienceSchema } from '../experiences/experiences.js';
import { ProjectSchema } from '../projects/projects.js';
import { ResourceSchema } from '../resources/resources.js';
import { SocialLinkSchema } from '../social-links/social-links.js';
import { ToolSchema } from '../tools/tools.js';
import { HttpUrlSchema } from './url.js';

const DANGEROUS = [
  'javascript:alert(document.domain)',
  'JavaScript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'mailto:contact@example.test',
  'tel:+33100000000',
  'ftp://example.test/fichier',
  'file:///fichier-local',
  '//example.test/protocole-relatif',
  'example.test',
];

describe('HttpUrlSchema', () => {
  it.each([
    'https://example.test',
    'http://example.test/a?b=c#d',
    'https://sous.domaine.test:8443/x',
  ])('accepte %s', (url) => {
    expect(HttpUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each(DANGEROUS)('refuse %s', (url) => {
    expect(HttpUrlSchema.safeParse(url).success).toBe(false);
  });
});

describe('les URL des contrats refusent les protocoles dangereux', () => {
  const socialLink = { slug: 'github', kind: 'github', label: 'GitHub' };

  it.each(DANGEROUS)('SocialLink.url : %s', (url) => {
    expect(SocialLinkSchema.safeParse({ ...socialLink, url }).success).toBe(false);
  });

  it.each([
    ['Resource', ResourceSchema, 'url'],
    ['Project', ProjectSchema, 'url'],
    ['Project', ProjectSchema, 'repoUrl'],
    ['Tool', ToolSchema, 'url'],
    ['Experience', ExperienceSchema, 'companyUrl'],
    ['Education', EducationSchema, 'url'],
    ['Certification', CertificationSchema, 'url'],
  ] as const)('%s.%s utilise HttpUrlSchema', (_name, schema, key) => {
    const field = (schema.shape as Record<string, { parse: (value: unknown) => unknown }>)[key];

    expect(() => field?.parse('javascript:alert(1)')).toThrow();
    expect(() => field?.parse('https://example.test')).not.toThrow();
  });
});
