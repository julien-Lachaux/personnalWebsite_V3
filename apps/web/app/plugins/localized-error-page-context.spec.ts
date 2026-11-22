import { describe, expect, it } from 'vitest';

import { forgetErrorPagePath } from './localized-error-page.server.js';

// Greffon localized-error-page (F7) : `app:rendered` déclare le contexte de rendu facultatif ; sans
// contexte, le greffon ne fait rien et ne lève pas.

describe('greffon localized-error-page sans contexte de rendu', () => {
  it('ne fait rien sans contexte', () => {
    expect(() => forgetErrorPagePath(undefined)).not.toThrow();
  });
});
