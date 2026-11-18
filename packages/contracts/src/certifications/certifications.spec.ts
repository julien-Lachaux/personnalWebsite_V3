import { describe, expect, it } from 'vitest';

import { CertificationSchema } from './certifications.js';

const valid = {
  slug: 'certif',
  issuer: 'Organisme',
  year: 2024,
  url: null,
  name: 'Certification',
};

describe('CertificationSchema', () => {
  it('accepte une certification avec ou sans URL', () => {
    expect(CertificationSchema.safeParse(valid).success).toBe(true);
    expect(CertificationSchema.safeParse({ ...valid, url: 'https://example.com/c' }).success).toBe(
      true,
    );
  });

  it('refuse une année non entière', () => {
    expect(CertificationSchema.safeParse({ ...valid, year: '2024' }).success).toBe(false);
  });
});
