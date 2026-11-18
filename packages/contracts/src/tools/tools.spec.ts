import { describe, expect, it } from 'vitest';

import { ToolSchema } from './tools.js';

const valid = {
  slug: 'vscode',
  url: 'https://example.com/vscode',
  iconPath: '/icons/vscode.svg',
  name: 'VS Code',
  family: 'IDE',
  description: 'Éditeur.',
};

describe('ToolSchema', () => {
  it('accepte un outil valide', () => {
    expect(ToolSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte un outil sans site ni icône', () => {
    expect(ToolSchema.safeParse({ ...valid, url: null, iconPath: null }).success).toBe(true);
  });

  it('refuse une clé inconnue et un slug invalide', () => {
    expect(ToolSchema.safeParse({ ...valid, published: true }).success).toBe(false);
    expect(ToolSchema.safeParse({ ...valid, slug: 'VS_Code' }).success).toBe(false);
  });
});
