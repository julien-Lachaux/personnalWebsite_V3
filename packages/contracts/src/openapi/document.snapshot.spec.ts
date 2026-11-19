import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

import { createOpenApiDocument } from './document.js';

// Le document OpenAPI généré EST le contrat que le portage Rust (utoipa) devra honorer : libellés,
// descriptions, exemples, operationId et ordre des composants compris. Ce test fige le document
// entier dans un fichier JSON lisible et versionné ; toute dérive d'un mot échoue.
// Pour accepter un changement voulu du contrat : `pnpm --filter @siteperso/contracts exec vitest
// run -u src/openapi/document.snapshot.spec.ts`, puis relire le diff du fichier avant de committer.
describe('document OpenAPI généré (instantané du contrat)', () => {
  it('correspond au fichier de référence openapi.json, libellé par libellé', async () => {
    // Mis en forme par Prettier (mêmes options que le dépôt) : `pnpm format` ne réécrit pas le fichier.
    const text = await format(JSON.stringify(createOpenApiDocument()), {
      parser: 'json',
      printWidth: 100,
      tabWidth: 2,
    });
    await expect(text).toMatchFileSnapshot('./__snapshots__/openapi.json');
  });

  it('garde l’ordre alphabétique des composants (sortComponents)', () => {
    const names = Object.keys(createOpenApiDocument().components?.schemas ?? {});
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('nomme chaque opération de façon unique, de la forme getNom ou listNoms', () => {
    const operationIds = Object.values(createOpenApiDocument().paths ?? {}).map(
      (item) => item.get?.operationId,
    );
    expect(operationIds).toHaveLength(13);
    expect(new Set(operationIds).size).toBe(13);
    for (const id of operationIds) {
      expect(id).toMatch(/^(get|list)[A-Z][A-Za-z]+$/);
    }
  });
});
