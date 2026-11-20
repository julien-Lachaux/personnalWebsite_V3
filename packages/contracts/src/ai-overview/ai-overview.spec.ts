import { describe, expect, it } from 'vitest';

import { AiOverviewSchema } from './ai-overview.js';

/** Section IA fictive (BF-5). */
const valid = {
  title: 'L’IA',
  inProductLabel: 'dans le produit',
  inProductItems: ['Premier usage', 'Second usage'],
  dailyLabel: 'au quotidien',
  dailyText: 'Usage quotidien.',
  skills: [
    {
      slug: 'mastra',
      name: 'Mastra',
      level: 3,
      icon: 'mastra',
      iconPath: null,
      groupSlug: 'ia',
      mainStackOrder: null,
    },
  ],
};

type Key = keyof typeof valid;

function without(key: Key): Partial<typeof valid> {
  const copy: Partial<typeof valid> = { ...valid };
  delete copy[key];
  return copy;
}

describe('AiOverviewSchema (BF-5)', () => {
  it('accepte une section complète, avec ou sans compétence liée', () => {
    expect(AiOverviewSchema.parse(valid)).toEqual(valid);
    expect(AiOverviewSchema.safeParse({ ...valid, skills: [] }).success).toBe(true);
  });

  it.each<Key>(['title', 'inProductLabel', 'inProductItems', 'dailyLabel', 'dailyText', 'skills'])(
    'exige %s',
    (key) => {
      expect(AiOverviewSchema.safeParse(without(key)).success).toBe(false);
    },
  );

  it.each(['title', 'inProductLabel', 'dailyLabel', 'dailyText'] as const)(
    'refuse %s vide',
    (key) => {
      expect(AiOverviewSchema.safeParse({ ...valid, [key]: '' }).success).toBe(false);
    },
  );

  it('exige au moins un usage dans le produit, aucun vide', () => {
    expect(AiOverviewSchema.safeParse({ ...valid, inProductItems: [] }).success).toBe(false);
    expect(AiOverviewSchema.safeParse({ ...valid, inProductItems: ['A', ''] }).success).toBe(false);
    expect(AiOverviewSchema.safeParse({ ...valid, inProductItems: 'A' }).success).toBe(false);
    expect(AiOverviewSchema.safeParse({ ...valid, inProductItems: ['Seul'] }).success).toBe(true);
  });

  it('valide les compétences liées et refuse les clés inconnues', () => {
    const [skill] = valid.skills;
    expect(AiOverviewSchema.safeParse({ ...valid, skills: [{ ...skill, level: 9 }] }).success).toBe(
      false,
    );
    expect(AiOverviewSchema.safeParse({ ...valid, id: 1 }).success).toBe(false);
    expect(AiOverviewSchema.safeParse({ ...valid, todo: 'À compléter' }).success).toBe(false);
  });
});
