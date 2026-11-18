import { describe, expect, it } from 'vitest';

import { IsoDateSchema } from './date.js';
import {
  CEFR_LEVELS,
  CONTRACT_TYPES,
  CefrLevelSchema,
  ContractTypeSchema,
  EXPERIENCE_KINDS,
  ExperienceKindSchema,
  WORK_MODES,
  WorkModeSchema,
} from './enums.js';
import { ImageSchema } from './image.js';
import { LOCALES } from './locale.js';
import { SlugSchema } from './slug.js';

describe('SlugSchema', () => {
  it('accepte minuscules, chiffres et tirets simples', () => {
    expect(SlugSchema.safeParse('node-js').success).toBe(true);
    expect(SlugSchema.safeParse('vue3').success).toBe(true);
  });

  it.each(['Foo_bar', 'Foo', '-a', 'a-', 'a--b', '', 'a b'])('rejette %j', (value) => {
    expect(SlugSchema.safeParse(value).success).toBe(false);
  });
});

describe('IsoDateSchema', () => {
  it('accepte une date calendaire valide', () => {
    expect(IsoDateSchema.parse('2026-02-01')).toBe('2026-02-01');
  });

  it.each(['2026-13-01', '2026-02-30', '2026-1-1', '2026-01-01T00:00:00Z', ''])(
    'rejette %j',
    (value) => {
      expect(IsoDateSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('ImageSchema', () => {
  it('accepte un chemin et un texte alternatif', () => {
    expect(ImageSchema.safeParse({ path: '/images/a.webp', alt: 'Portrait' }).success).toBe(true);
  });

  it('exige un texte alternatif non vide et refuse les clés inconnues', () => {
    expect(ImageSchema.safeParse({ path: '/images/a.webp', alt: '' }).success).toBe(false);
    expect(ImageSchema.safeParse({ path: '/images/a.webp' }).success).toBe(false);
    expect(ImageSchema.safeParse({ path: '/a', alt: 'x', extra: 1 }).success).toBe(false);
  });
});

describe('enums', () => {
  it('exposent les valeurs de docs/01', () => {
    expect(LOCALES).toEqual(['fr', 'en']);
    expect(EXPERIENCE_KINDS).toEqual(['employment', 'freelance', 'break', 'mentoring']);
    expect(CONTRACT_TYPES).toEqual(['cdi', 'freelance', 'none']);
    expect(WORK_MODES).toEqual(['onsite', 'hybrid', 'remote']);
    expect(CEFR_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });

  it('refusent une valeur hors enum', () => {
    expect(ExperienceKindSchema.safeParse('internship').success).toBe(false);
    expect(ContractTypeSchema.safeParse('CDI').success).toBe(false);
    expect(WorkModeSchema.safeParse('office').success).toBe(false);
    expect(CefrLevelSchema.safeParse('Z9').success).toBe(false);
  });
});
