import { describe, expect, it } from 'vitest';

import { SkillSchema } from '../skills/skills.js';
import { ExperienceSchema, ExperienceSkillSchema } from './experiences.js';

/** Compétence liée à une expérience (BF-2) : contenu fictif. */
const linked = {
  slug: 'ocr',
  name: 'OCR',
  level: 3,
  icon: 'ocr',
  iconPath: null,
  groupSlug: 'ia',
  mainStackOrder: null,
  shownInStack: false,
};

const { shownInStack: _shown, ...skill } = linked;

const experience = {
  slug: 'societe-exemple',
  kind: 'employment',
  company: 'Société exemple',
  companyUrl: null,
  logo: null,
  contractType: 'cdi',
  workMode: 'remote',
  dateStart: '2024-01-01',
  dateEnd: null,
  jobTitle: 'Développeur',
  location: null,
  summary: '',
  achievements: [],
  stackLabel: null,
  skills: [{ ...linked, slug: 'typescript', shownInStack: true }, linked],
};

describe('ExperienceSkillSchema (BF-2)', () => {
  it('accepte une compétence affichée comme une compétence cachée', () => {
    expect(ExperienceSkillSchema.parse(linked)).toEqual(linked);
    expect(ExperienceSkillSchema.parse({ ...linked, shownInStack: true }).shownInStack).toBe(true);
  });

  it('exige shownInStack, booléen', () => {
    expect(ExperienceSkillSchema.safeParse(skill).success).toBe(false);
    expect(ExperienceSkillSchema.safeParse({ ...linked, shownInStack: 'false' }).success).toBe(
      false,
    );
    expect(ExperienceSkillSchema.safeParse({ ...linked, shownInStack: null }).success).toBe(false);
  });

  it('reste strict et valide les champs de Skill', () => {
    expect(ExperienceSkillSchema.safeParse({ ...linked, sortOrder: 1 }).success).toBe(false);
    expect(ExperienceSkillSchema.safeParse({ ...linked, level: 6 }).success).toBe(false);
    expect(ExperienceSkillSchema.safeParse({ ...linked, slug: 'Pas un slug' }).success).toBe(false);
  });

  it('Skill seul refuse shownInStack : le champ est propre au lien avec une expérience', () => {
    expect(SkillSchema.safeParse(skill).success).toBe(true);
    expect(SkillSchema.safeParse(linked).success).toBe(false);
  });

  it('Experience.skills porte shownInStack sur chaque compétence', () => {
    expect(ExperienceSchema.parse(experience).skills.map((s) => s.shownInStack)).toEqual([
      true,
      false,
    ]);
    expect(ExperienceSchema.safeParse({ ...experience, skills: [skill] }).success).toBe(false);
  });
});
