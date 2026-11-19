import { describe, expect, it } from 'vitest';

import { EducationSchema } from './education.js';

const valid = {
  slug: 'master',
  institution: 'Université',
  yearStart: 2008,
  yearEnd: 2010,
  url: null,
  title: 'Master',
  description: null,
};

describe('EducationSchema : refus d’une fin antérieure au début', () => {
  it('désigne le champ yearEnd et explique le refus', () => {
    const result = EducationSchema.safeParse({ ...valid, yearEnd: 2007 });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]?.path).toEqual(['yearEnd']);
    expect(result.error?.issues[0]?.message).toBe(
      'yearEnd doit être supérieur ou égal à yearStart',
    );
  });

  it('accepte une fin égale au début (limite incluse)', () => {
    expect(EducationSchema.safeParse({ ...valid, yearEnd: 2008 }).success).toBe(true);
  });

  it('ne signale que la fin quand le début est lui aussi hors bornes', () => {
    const result = EducationSchema.safeParse({ ...valid, yearStart: 1900 });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['yearStart']]);
  });
});
