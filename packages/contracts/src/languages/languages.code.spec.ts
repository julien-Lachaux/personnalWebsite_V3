import { describe, expect, it } from 'vitest';

import { LanguageSchema } from './languages.js';

const valid = {
  slug: 'en',
  code: 'en',
  cefrLevel: 'C1',
  name: 'Anglais',
  levelLabel: 'professionnel',
};

describe('LanguageSchema : code ISO 639-1', () => {
  it.each(['fr', 'en', 'de'])('accepte le code à deux lettres %s', (code) => {
    expect(LanguageSchema.safeParse({ ...valid, code }).success).toBe(true);
  });

  it.each(['fra', 'xfr', 'f', '', 'f1', '1f', 'fr ', ' fr', 'fr\n', 'Fr'])(
    'refuse le code %j (exactement deux lettres minuscules)',
    (code) => {
      expect(LanguageSchema.safeParse({ ...valid, code }).success).toBe(false);
    },
  );
});
