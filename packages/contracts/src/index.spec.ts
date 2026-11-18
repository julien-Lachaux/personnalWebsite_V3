import { describe, expect, expectTypeOf, it } from 'vitest';

import * as contracts from './index.js';
import {
  type Certification,
  type Cv,
  type Education,
  type Experience,
  type HealthResponse,
  type Language,
  type Locale,
  type LocaleQuery,
  type ProblemDetails,
  type Profile,
  type Project,
  type Resource,
  type Skill,
  type SkillGroup,
  type SocialLink,
  type Tool,
} from './index.js';

describe('exports du paquet', () => {
  it('expose schémas, constantes et générateur OpenAPI', () => {
    const expected = [
      'ProfileSchema',
      'SocialLinkSchema',
      'SkillSchema',
      'SkillGroupSchema',
      'ExperienceSchema',
      'ProjectSchema',
      'ToolSchema',
      'ResourceSchema',
      'CertificationSchema',
      'EducationSchema',
      'LanguageSchema',
      'CvSchema',
      'ProblemDetailsSchema',
      'HealthResponseSchema',
      'LocaleSchema',
      'LocaleQuerySchema',
      'SlugSchema',
      'IsoDateSchema',
      'ImageSchema',
      'ExperienceKindSchema',
      'ContractTypeSchema',
      'WorkModeSchema',
      'CefrLevelSchema',
      'LOCALES',
      'EXPERIENCE_KINDS',
      'CONTRACT_TYPES',
      'WORK_MODES',
      'CEFR_LEVELS',
      'createOpenApiDocument',
    ];
    for (const key of expected) {
      expect(contracts, key).toHaveProperty(key);
    }
  });
});

describe('types inférés', () => {
  it('reflètent le contrat (nullable présent, enums littéraux)', () => {
    expectTypeOf<Locale>().toEqualTypeOf<'fr' | 'en'>();
    expectTypeOf<LocaleQuery>().toEqualTypeOf<{ lang: 'fr' | 'en' }>();
    expectTypeOf<Experience['kind']>().toEqualTypeOf<
      'employment' | 'freelance' | 'break' | 'mentoring'
    >();
    expectTypeOf<Experience['company']>().toEqualTypeOf<string | null>();
    expectTypeOf<Experience['dateEnd']>().toEqualTypeOf<string | null>();
    expectTypeOf<Experience['achievements']>().toEqualTypeOf<string[]>();
    expectTypeOf<Skill['iconPath']>().toEqualTypeOf<string | null>();
    expectTypeOf<Language['cefrLevel']>().toEqualTypeOf<
      'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null
    >();
    expectTypeOf<ProblemDetails['status']>().toEqualTypeOf<number>();
    expectTypeOf<HealthResponse['status']>().toEqualTypeOf<'ok'>();
  });

  it('compose le CV à partir des types de ressources', () => {
    expectTypeOf<Cv['locale']>().toEqualTypeOf<Locale>();
    expectTypeOf<Cv['profile']>().toEqualTypeOf<Profile>();
    expectTypeOf<Cv['socialLinks']>().toEqualTypeOf<SocialLink[]>();
    expectTypeOf<Cv['skillGroups']>().toEqualTypeOf<SkillGroup[]>();
    expectTypeOf<Cv['experiences']>().toEqualTypeOf<Experience[]>();
    expectTypeOf<Cv['projects']>().toEqualTypeOf<Project[]>();
    expectTypeOf<Cv['tools']>().toEqualTypeOf<Tool[]>();
    expectTypeOf<Cv['resources']>().toEqualTypeOf<Resource[]>();
    expectTypeOf<Cv['certifications']>().toEqualTypeOf<Certification[]>();
    expectTypeOf<Cv['education']>().toEqualTypeOf<Education[]>();
    expectTypeOf<Cv['languages']>().toEqualTypeOf<Language[]>();
    expectTypeOf<Cv>().not.toHaveProperty('skills');
  });
});
