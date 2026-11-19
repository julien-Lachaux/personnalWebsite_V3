import { describe, expect, it } from 'vitest';

import { splitSqlStatements, statementVerb } from './sql-statements.js';

describe('splitSqlStatements : opérateurs proches des délimiteurs de commentaire', () => {
  it('ne prend pas un moins isolé pour un commentaire de ligne', () => {
    expect(splitSqlStatements('select 5 - 3; select 1')).toEqual(['select 5 - 3', 'select 1']);
    expect(splitSqlStatements('select 5-3; select 1')).toEqual(['select 5-3', 'select 1']);
  });

  it('ne prend pas un point-virgule suivi d’un commentaire pour le début de ce commentaire', () => {
    expect(splitSqlStatements('select 1;-- suite\nselect 2')).toEqual([
      'select 1',
      '-- suite\nselect 2',
    ]);
  });

  it('ne prend pas une division ou une multiplication pour un commentaire de bloc', () => {
    expect(splitSqlStatements('select 6 / 3; select 1')).toEqual(['select 6 / 3', 'select 1']);
    expect(splitSqlStatements('select 2*3; select 1')).toEqual(['select 2*3', 'select 1']);
    expect(splitSqlStatements('select 6 /3; select 2 * 2; select 3')).toEqual([
      'select 6 /3',
      'select 2 * 2',
      'select 3',
    ]);
  });

  it('ne referme pas un commentaire de bloc sur la barre de son propre ouverture', () => {
    expect(splitSqlStatements('select 1 /*/ a; b */; select 2')).toEqual([
      'select 1 /*/ a; b */',
      'select 2',
    ]);
  });

  it('ne cherche une étiquette de dollars qu’à l’endroit du dollar', () => {
    expect(splitSqlStatements('select $1; select $tag$ x; y $tag$')).toEqual([
      'select $1',
      'select $tag$ x; y $tag$',
    ]);
  });

  it('referme une chaîne vide juste avant le point-virgule', () => {
    expect(splitSqlStatements("select '';select 2")).toEqual(["select ''", 'select 2']);
    expect(splitSqlStatements('select "";select 2')).toEqual(['select ""', 'select 2']);
  });
});

describe('statementVerb : le verbe commence l’instruction', () => {
  it.each([
    ['(select 1)', ''],
    ['1abc', ''],
    ['; select 1', ''],
    ['  \n-- note\n(select 1)', ''],
  ])('%j ne donne aucun verbe', (statement, verb) => {
    expect(statementVerb(statement)).toBe(verb);
  });

  it('saute plusieurs commentaires et blancs successifs avant le verbe', () => {
    expect(statementVerb('-- un\n  -- deux\n/* trois */\n/* quatre */Select 1')).toBe('select');
  });

  it('saute un commentaire de bloc sur plusieurs lignes', () => {
    expect(statementVerb('/* ligne un\nligne deux */ insert into t values (1)')).toBe('insert');
  });
});
