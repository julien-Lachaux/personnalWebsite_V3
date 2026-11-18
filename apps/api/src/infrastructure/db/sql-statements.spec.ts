import { describe, expect, it } from 'vitest';

import { splitSqlStatements, statementVerb } from './sql-statements.js';

describe('splitSqlStatements', () => {
  it('découpe sur les point-virgules', () => {
    expect(splitSqlStatements('select 1; select 2;')).toEqual(['select 1', 'select 2']);
  });

  it('accepte une dernière instruction sans point-virgule', () => {
    expect(splitSqlStatements('select 1;\nselect 2')).toEqual(['select 1', 'select 2']);
  });

  it('ignore un point-virgule dans une chaîne, y compris avec une apostrophe échappée', () => {
    expect(
      splitSqlStatements("insert into t values ('a; b', 'l''un; l''autre'); select 1;"),
    ).toEqual(["insert into t values ('a; b', 'l''un; l''autre')", 'select 1']);
  });

  it('ignore un point-virgule dans un commentaire de ligne ou de bloc', () => {
    const sql = '-- une; note\nselect 1 /* a; b */;\n-- fin; seule\n';

    expect(splitSqlStatements(sql)).toEqual(['-- une; note\nselect 1 /* a; b */']);
  });

  it('ignore un point-virgule dans un littéral entre dollars et dans un identifiant quoté', () => {
    expect(splitSqlStatements('select $$a;b$$, $tag$c;d$tag$, "e;f";select 2')).toEqual([
      'select $$a;b$$, $tag$c;d$tag$, "e;f"',
      'select 2',
    ]);
  });

  it('écarte les fragments qui ne contiennent que des commentaires', () => {
    expect(splitSqlStatements('-- rien\n;/* vide */;')).toEqual([]);
  });
});

describe('statementVerb', () => {
  it.each([
    ['insert into t values (1)', 'insert'],
    ['  \n-- commentaire\n/* bloc */ UPDATE t set a = 1', 'update'],
    ['Delete from t', 'delete'],
    ['', ''],
    ['-- seulement un commentaire', ''],
  ])('%j donne %j', (statement, verb) => {
    expect(statementVerb(statement)).toBe(verb);
  });
});
