/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// CV PDF versionnés dans public/cv/ (D22, SPEC § 11) : un fichier par langue, `cv-<langue>.pdf`, dont
// les métadonnées ont été nettoyées par apps/web/scripts/clean-cv-pdf.sh. Le test relit les octets :
// le script écrit un PDF sans flux d'objets ni mise à jour incrémentale, où chaque dictionnaire est en
// clair ; une clé de métadonnées présente dans le fichier y apparaît donc telle quelle.

const cvDirectory = join(import.meta.dirname, '../public/cv');

/** Clés du dictionnaire d'information et des métadonnées de document (PDF 1.7, § 14.3). */
const METADATA_KEYS = [
  '/Info',
  '/Metadata',
  '/Author',
  '/Creator',
  '/Producer',
  '/CreationDate',
  '/ModDate',
  '/Title',
  '/Subject',
  '/Keywords',
  '/Trapped',
  '/PieceInfo',
];

/** Raisons pour lesquelles un PDF (octets lus en latin1) garde ou peut cacher des métadonnées. */
function metadataProblems(pdf: string): string[] {
  const problems: string[] = [];
  if (!pdf.startsWith('%PDF-')) problems.push('pas un PDF');
  if (pdf.includes('/ObjStm')) problems.push('flux d’objets (dictionnaires compressés)');
  if (/\/Type\s*\/XRef\b/.test(pdf)) problems.push('table de références en flux');
  if (pdf.match(/startxref/g)?.length !== 1) problems.push('mise à jour incrémentale');
  for (const key of METADATA_KEYS) {
    if (pdf.includes(key)) problems.push(key);
  }
  if (/<\?xpacket|<x:xmpmeta/.test(pdf)) problems.push('paquet XMP');
  return problems;
}

const files = readdirSync(cvDirectory).sort();

describe('CV PDF de public/cv', () => {
  it('contient le CV français (repli de toute langue sans CV), un fichier par langue', () => {
    expect(files).toContain('cv-fr.pdf');
    for (const file of files) expect(file).toMatch(/^cv-[a-z]{2}\.pdf$/);
  });

  for (const file of files) {
    it(`${file} : aucune métadonnée (auteur, logiciel, dates, XMP)`, () => {
      const pdf = readFileSync(join(cvDirectory, file)).toString('latin1');

      expect(metadataProblems(pdf)).toEqual([]);
    });
  }

  // Témoin de l'oracle : la même analyse signale bien un PDF non nettoyé, sinon une liste vide
  // ci-dessus ne prouverait rien.
  it('signale les métadonnées et ce qui pourrait les cacher', () => {
    const raw = [
      '%PDF-1.3',
      '1 0 obj << /Type /Catalog /Metadata 3 0 R >> endobj',
      '2 0 obj << /Author (A) /Creator (B) /Producer (C) /CreationDate (D:2026) /ModDate (D:2026)',
      '/Title (T) /Subject (S) /Keywords (K) /Trapped /False >> endobj',
      '3 0 obj << /Type /Metadata >> stream <?xpacket begin=""?><x:xmpmeta/> endstream endobj',
      '4 0 obj << /PieceInfo << >> >> endobj',
      'trailer << /Root 1 0 R /Info 2 0 R >> startxref 0 %%EOF',
    ].join('\n');

    expect(metadataProblems(raw)).toEqual([...METADATA_KEYS, 'paquet XMP']);
    expect(metadataProblems('<< /Type /ObjStm >> << /Type /XRef >>')).toEqual([
      'pas un PDF',
      'flux d’objets (dictionnaires compressés)',
      'table de références en flux',
      'mise à jour incrémentale',
    ]);
    expect(metadataProblems('%PDF-1.3 startxref 0 %%EOF startxref 9 %%EOF')).toEqual([
      'mise à jour incrémentale',
    ]);
    expect(metadataProblems('%PDF-1.3 << /Type /Catalog >> startxref 0 %%EOF')).toEqual([]);
  });
});
