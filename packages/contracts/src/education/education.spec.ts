import { describe, expect, it } from 'vitest';

import { EducationSchema } from './education.js';

const valid = {
  slug: 'master',
  institution: 'Université',
  yearStart: 2008,
  yearEnd: 2010,
  url: null,
  title: 'Master',
  description: 'Description.',
};

describe('EducationSchema', () => {
  it('accepte une formation terminée ou en cours', () => {
    expect(EducationSchema.safeParse(valid).success).toBe(true);
    expect(EducationSchema.safeParse({ ...valid, yearEnd: null }).success).toBe(true);
    expect(EducationSchema.safeParse({ ...valid, yearEnd: 2008 }).success).toBe(true);
  });

  it('accepte une description nulle (colonne description nullable en SQL)', () => {
    expect(EducationSchema.safeParse({ ...valid, description: null }).success).toBe(true);
  });

  it('rejette yearEnd antérieur à yearStart', () => {
    const result = EducationSchema.safeParse({ ...valid, yearEnd: 2007 });
    expect(result.success).toBe(false);
  });
});
