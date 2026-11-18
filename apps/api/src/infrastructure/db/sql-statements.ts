/**
 * Découpe un fichier SQL en instructions, sur les `;` situés hors commentaires, chaînes entre
 * apostrophes (`''` échappé), identifiants entre guillemets et littéraux entre dollars
 * (`$$…$$`, `$tag$…$tag$`). Les commentaires sont conservés dans le texte des instructions ;
 * un fragment qui ne contient que des commentaires et des espaces est écarté.
 */
export function splitSqlStatements(content: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let index = 0;
  let hasCode = false;

  const flush = (end: number): void => {
    if (hasCode) {
      statements.push(content.slice(start, end).trim());
    }
    start = end + 1;
    hasCode = false;
  };

  while (index < content.length) {
    const char = content.charAt(index);
    const next = content.charAt(index + 1);

    if (char === '-' && next === '-') {
      const end = content.indexOf('\n', index);
      index = end === -1 ? content.length : end + 1;
    } else if (char === '/' && next === '*') {
      const end = content.indexOf('*/', index + 2);
      index = end === -1 ? content.length : end + 2;
    } else if (char === "'" || char === '"') {
      hasCode = true;
      index = skipQuoted(content, index, char);
    } else if (char === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(content.slice(index))?.[0];
      hasCode = true;
      if (tag === undefined) {
        index += 1;
      } else {
        const end = content.indexOf(tag, index + tag.length);
        index = end === -1 ? content.length : end + tag.length;
      }
    } else if (char === ';') {
      flush(index);
      index += 1;
    } else {
      if (!/\s/.test(char)) {
        hasCode = true;
      }
      index += 1;
    }
  }
  flush(content.length);
  return statements;
}

/** Index qui suit la chaîne ou l'identifiant quoté ouvert en `from` (le délimiteur double échappe). */
function skipQuoted(content: string, from: number, quote: string): number {
  let index = from + 1;
  while (index < content.length) {
    if (content.charAt(index) === quote) {
      if (content.charAt(index + 1) === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return content.length;
}

/**
 * Verbe de l'instruction (`insert`, `update`, `delete`, `select`…), en minuscules, après les
 * commentaires de tête ; chaîne vide si l'instruction n'en a pas.
 */
export function statementVerb(statement: string): string {
  const stripped = statement.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '');
  return /^[A-Za-z]+/.exec(stripped)?.[0].toLowerCase() ?? '';
}
