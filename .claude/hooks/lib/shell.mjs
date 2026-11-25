// Analyse d'une commande shell (bash et zsh, le shell de l'outil Bash) : repère les cibles
// d'écriture (redirections, rm, mv, cp, tee, sed -i, perl -i, dd, git checkout/restore/rm/mv,
// find -delete…), les écritures opaques (interpréteurs avec code en ligne ou script, xargs, git
// apply, patch) et les commandes interdites (--no-verify, core.hooksPath…). git push n'est permis
// qu'à la session principale, vers origin et pour develop ou lot/<nom> seulement (git flow, L20-01) :
// voir pushRefusal. La plomberie de push, la redéfinition de la destination (git remote, git config)
// et les actions de gh qui étiquettent, publient ou suppriment sont refusées à tous ; gh n'écrit sur
// GitHub que pour le flux par pull request de la session principale (L20-01, voir analyzeGh).
//
// L'analyseur descend dans les constructions composées comme dans les listes : accolades, sous-shells,
// if, for, while, until, case, !, fonctions, coproc, substitutions de commande (y compris entre
// guillemets et dans un here-document non protégé) et de processus. Principe « illisible donc
// refusé » (lot 13 bis) : ce qu'il ne sait pas lire est refusé, jamais laissé passer en silence —
// syntaxe incomplète ou inconnue, nom de commande, sous-commande git, cible d'écriture, script ou
// code calculés (variable inconnue, substitution, expansion d'accolades), code lu sur un tube.
// Seules les variables affectées en clair dans la même commande, HOME (et ~) et PWD sont résolues.
//
// Ce n'est pas un interpréteur complet : un programme qui écrit sans nommer le fichier lui échappe ;
// le hook de fin (comparaison des empreintes) et le script d'intégrité de la CI sont les filets.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

/** Erreur de lecture d'une commande (guillemet non refermé…) : le hook refuse (fail-closed). */
export class ShellParseError extends Error {}

/** Profondeur maximale d'imbrication (substitutions, code shell dans du code shell, alias). */
const MAX_DEPTH = 12;
/** Préfixe d'un mot dont la valeur n'est pas lisible (variable inconnue, substitution…). */
export const UNKNOWN = '\u0000';
/** Bornes d'un sous-shell : un cd ou une affectation n'en sort pas. */
const ENTER = Object.freeze({ marker: 'enter' });
const LEAVE = Object.freeze({ marker: 'leave' });

/** Mots réservés retirés en tête de commande : la commande qui suit est analysée normalement. */
const DROPPED_RESERVED = new Set([
  '{',
  '}',
  '!',
  'if',
  'then',
  'elif',
  'else',
  'fi',
  'do',
  'done',
  'while',
  'until',
  'coproc',
  'function',
  'repeat',
]);
/** En-têtes dont les mots ne sont pas une commande (leurs substitutions sont analysées). */
const HEADER_RESERVED = new Set(['for', 'select', 'foreach', 'case']);

function newWord() {
  // parts : { t: 'lit', v } | { t: 'var', name, raw } | { t: 'dyn', raw }
  // unq   : caractères hors guillemets (Q pour une partie protégée), pour l'expansion d'accolades.
  return { parts: [], quoted: false, procsub: false, unq: '' };
}

function addLit(w, v) {
  const last = w.parts[w.parts.length - 1];
  if (last && last.t === 'lit') last.v += v;
  else w.parts.push({ t: 'lit', v });
}

function addPart(w, part) {
  if (part.t === 'lit') addLit(w, part.v);
  else {
    w.parts.push(part);
    w.unq += 'D';
  }
}

function partText(p) {
  return p.t === 'lit' ? p.v : p.raw;
}

/** Texte d'un mot pour les messages (expansions laissées telles quelles). */
export function wordText(w) {
  return w.parts.map(partText).join('');
}

function isLiteral(w) {
  return w.parts.every((p) => p.t === 'lit');
}

function newSegment(kind, pipedIn = false) {
  return {
    words: [],
    redirects: [],
    inputs: [],
    heredoc: '',
    dynamicInput: false,
    kind,
    pipedIn,
    drop: 0,
    coproc: false,
    header: null,
  };
}

const NAME_RE = /[A-Za-z_][A-Za-z0-9_]*/y;

/**
 * Lecteur récursif. Les segments (commandes simples) sont ajoutés à `out` dans l'ordre où ils
 * se terminent ; les substitutions et sous-shells sont encadrés par ENTER et LEAVE.
 */
class ShellParser {
  constructor(src, out, depth) {
    if (depth > MAX_DEPTH) throw new ShellParseError('imbrication trop profonde');
    this.s = src;
    this.n = src.length;
    this.i = 0;
    this.out = out;
    this.depth = depth;
    this.heredocs = [];
  }

  /** `$…` ou accent grave à la position courante : partie lue, ou null pour un `$` littéral. */
  parseDollar() {
    const s = this.s;
    const next = s[this.i + 1];
    if (s[this.i] === '`') return this.parseBacktick();
    if (next === '(') return this.parseCommandSubst();
    if (next === '{') return this.parseParam();
    if (next === '[') throw new ShellParseError('expansion arithmétique $[…] non prise en charge');
    NAME_RE.lastIndex = this.i + 1;
    const m = NAME_RE.exec(s);
    if (m) {
      this.i += 1 + m[0].length;
      const raw = `$${m[0]}`;
      // zsh : $x[1], $x:h… transforment la valeur ; illisible.
      if (s[this.i] === '[' || (s[this.i] === ':' && /[A-Za-z&]/.test(s[this.i + 1] ?? ''))) {
        return { t: 'dyn', raw };
      }
      return { t: 'var', name: m[0], raw };
    }
    // $1, $@, $#, $?… et les formes de zsh ($=x, $~x, $^x, $+x) : valeur illisible.
    if (next !== undefined && /[0-9@*#?$!-]/.test(next)) {
      const raw = s.slice(this.i, this.i + 2);
      this.i += 2;
      return { t: 'dyn', raw };
    }
    if (next !== undefined && /[=~^+]/.test(next)) {
      let j = this.i + 2;
      NAME_RE.lastIndex = j;
      const name = NAME_RE.exec(s);
      if (name) j += name[0].length;
      const raw = s.slice(this.i, j);
      this.i = j;
      return { t: 'dyn', raw };
    }
    return null;
  }

  /** `$(…)` ou `$((…))` ; le contenu est analysé comme une commande. */
  parseCommandSubst() {
    const start = this.i;
    if (this.s[this.i + 2] === '(') {
      const outLen = this.out.length;
      const heredocs = this.heredocs.length;
      this.i += 3;
      if (this.scanArithmetic()) return { t: 'dyn', raw: '$((…))' };
      // Pas une expression arithmétique : $( (…) …) imbriqués.
      this.out.length = outLen;
      this.heredocs.length = heredocs;
      this.i = start;
    }
    this.i += 2;
    this.out.push(ENTER);
    this.parseList(')');
    this.out.push(LEAVE);
    return { t: 'dyn', raw: '$(…)' };
  }

  /** Accent grave : contenu déséchappé puis analysé comme une commande. */
  parseBacktick() {
    const s = this.s;
    let j = this.i + 1;
    let inner = '';
    while (j < this.n && s[j] !== '`') {
      if (s[j] === '\\' && j + 1 < this.n && '`$\\'.includes(s[j + 1])) {
        inner += s[j + 1];
        j += 2;
      } else {
        inner += s[j];
        j += 1;
      }
    }
    if (j >= this.n) throw new ShellParseError('accent grave non refermé');
    this.i = j + 1;
    this.out.push(ENTER);
    new ShellParser(inner, this.out, this.depth + 1).parseList(null);
    this.out.push(LEAVE);
    return { t: 'dyn', raw: '`…`' };
  }

  /** `${…}` : variable simple ou expansion illisible ; ses substitutions sont analysées. */
  parseParam() {
    const s = this.s;
    this.i += 2;
    let raw = '';
    while (this.i < this.n) {
      const c = s[this.i];
      if (c === '}') {
        this.i += 1;
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)
          ? { t: 'var', name: raw, raw: `\${${raw}}` }
          : { t: 'dyn', raw: `\${${raw}}` };
      }
      if (c === '\\') {
        raw += s.slice(this.i, this.i + 2);
        this.i += 2;
      } else if (c === "'") {
        const j = s.indexOf("'", this.i + 1);
        if (j < 0) throw new ShellParseError('apostrophe non refermée');
        raw += s.slice(this.i, j + 1);
        this.i = j + 1;
      } else if (c === '"') {
        this.parseDouble();
        raw += '"…"';
      } else if (c === '$' || c === '`') {
        const part = this.parseDollar();
        if (part) raw += part.raw;
        else {
          raw += c;
          this.i += 1;
        }
      } else {
        raw += c;
        this.i += 1;
      }
    }
    throw new ShellParseError('${…} non refermé');
  }

  /** Contenu entre guillemets doubles : parties littérales, variables et substitutions. */
  parseDouble() {
    const s = this.s;
    this.i += 1;
    const w = newWord();
    while (this.i < this.n && s[this.i] !== '"') {
      const c = s[this.i];
      const next = s[this.i + 1];
      if (c === '\\' && '"\\$`\n'.includes(next ?? '')) {
        if (next !== '\n') addLit(w, next);
        this.i += 2;
        continue;
      }
      if (c === '$' || c === '`') {
        const part = this.parseDollar();
        if (part) {
          w.parts.push(part);
          continue;
        }
      }
      addLit(w, c);
      this.i += 1;
    }
    if (this.i >= this.n) throw new ShellParseError('guillemet non refermé');
    this.i += 1;
    return w.parts;
  }

  /** Corps de `((…))` après les deux parenthèses ouvrantes : vrai s'il se referme par `))`. */
  scanArithmetic() {
    const s = this.s;
    let depth = 0;
    while (this.i < this.n) {
      const c = s[this.i];
      if (c === '$' || c === '`') {
        if (!this.parseDollar()) this.i += 1;
      } else if (c === '"') {
        this.parseDouble();
      } else if (c === "'") {
        const j = s.indexOf("'", this.i + 1);
        if (j < 0) return false;
        this.i = j + 1;
      } else if (c === '(') {
        depth += 1;
        this.i += 1;
      } else if (c === ')') {
        if (depth > 0) {
          depth -= 1;
          this.i += 1;
        } else if (s[this.i + 1] === ')') {
          this.i += 2;
          return true;
        } else {
          return false;
        }
      } else {
        this.i += 1;
      }
    }
    return false;
  }

  /** Corps d'un here-document non protégé : seules ses substitutions sont des commandes. */
  scanExpansions() {
    while (this.i < this.n) {
      const c = this.s[this.i];
      if (c === '\\') this.i += 2;
      else if ((c === '$' || c === '`') && this.parseDollar()) continue;
      else this.i += 1;
    }
  }

  /** Lit les corps des here-documents en attente, après une fin de ligne. */
  readHeredocBodies() {
    const s = this.s;
    while (this.heredocs.length > 0 && this.i < this.n) {
      const h = this.heredocs.shift();
      let body = '';
      while (this.i < this.n) {
        const end = s.indexOf('\n', this.i);
        const line = s.slice(this.i, end < 0 ? this.n : end);
        this.i = end < 0 ? this.n : end + 1;
        const compared = h.strip ? line.replace(/^\t+/, '') : line;
        if (compared === h.delim) break;
        body += `${line}\n`;
      }
      h.seg.heredoc += body;
      if (h.expand) {
        if (/[$`]/.test(body)) h.seg.dynamicInput = true;
        new ShellParser(body, this.out, this.depth + 1).scanExpansions();
      }
    }
  }

  /**
   * Liste de commandes jusqu'à `end` (')' ou null pour la fin du texte), terminateur consommé.
   * `kind` : 'command', ou 'data' pour un contenu qui n'est pas une commande (tableau, en-tête).
   */
  parseList(end, kind = 'command') {
    const s = this.s;
    const cases = [];
    let seg = newSegment(kind);
    let word = null;
    let pending = null; // 'redirect' | 'input' | 'herestring' | { strip }

    const ensure = () => {
      if (word === null) word = newWord();
      return word;
    };
    const top = () => cases[cases.length - 1];

    const endSegment = (piped = false) => {
      pushWord();
      if (pending !== null) throw new ShellParseError('redirection sans cible');
      if (seg.words.length > 0 || seg.redirects.length > 0 || seg.inputs.length > 0) {
        this.out.push(seg);
      }
      seg = newSegment(kind, piped);
    };

    const pushWord = () => {
      if (word === null) return;
      const w = word;
      word = null;
      // Expansion d'accolades ({a,b}, {1..3}) : le mot devient illisible.
      if (/\{[^{}]*(,|\.\.)[^{}]*\}/.test(w.unq)) w.parts = [{ t: 'dyn', raw: wordText(w) }];
      if (pending !== null) {
        if (pending === 'redirect') seg.redirects.push(w);
        else if (pending === 'input') seg.inputs.push(w);
        else if (pending === 'herestring') {
          seg.heredoc += `${wordText(w)}\n`;
          if (!isLiteral(w)) seg.dynamicInput = true;
        } else {
          this.heredocs.push({ delim: wordText(w), seg, strip: pending.strip, expand: !w.quoted });
        }
        pending = null;
        return;
      }
      if (seg.drop > 0) {
        seg.drop -= 1;
        return;
      }
      let text = !w.quoted && isLiteral(w) ? wordText(w) : null;
      if (seg.words.length === 0 && seg.kind === 'command') {
        if (top()?.phase === 'pattern') {
          if (text === 'esac') cases.pop();
          else {
            seg.kind = 'data';
            seg.words.push(w);
          }
          return;
        }
        if (text !== null) {
          if (top()?.phase === 'body' && text === 'esac') {
            cases.pop();
            return;
          }
          // zsh : « {git … » ouvre un groupe ; bash y verrait une commande inconnue.
          while (text.length > 1 && text.startsWith('{')) {
            text = text.slice(1);
            w.parts = [{ t: 'lit', v: text }];
          }
          if (DROPPED_RESERVED.has(text)) {
            if (text === 'coproc') seg.coproc = true;
            if (text === 'function' || text === 'repeat') seg.drop = 1;
            return;
          }
          if (HEADER_RESERVED.has(text)) {
            seg.kind = 'data';
            seg.header = text;
            if (text === 'case') cases.push({ phase: 'header' });
            seg.words.push(w);
            return;
          }
        }
      }
      if (seg.coproc && seg.words.length === 1 && text === '{') {
        // coproc NOM { … } : le nom n'est pas une commande.
        seg.words = [];
        seg.coproc = false;
        return;
      }
      seg.words.push(w);
      if (seg.header === 'case' && seg.words.length === 3 && text === 'in') {
        const c = top();
        endSegment();
        if (c) c.phase = 'pattern';
      }
    };

    while (this.i < this.n) {
      const c = s[this.i];
      const next = s[this.i + 1];
      if (c === '\\') {
        if (next === '\n') {
          this.i += 2;
          continue;
        }
        const w = ensure();
        w.quoted = true;
        addLit(w, next ?? '');
        w.unq += 'Q';
        this.i += 2;
        continue;
      }
      if (c === "'") {
        const j = s.indexOf("'", this.i + 1);
        if (j < 0) throw new ShellParseError('apostrophe non refermée');
        const w = ensure();
        w.quoted = true;
        addLit(w, s.slice(this.i + 1, j));
        w.unq += 'Q';
        this.i = j + 1;
        continue;
      }
      if (c === '$' && next === "'") {
        let j = this.i + 2;
        let out = '';
        while (j < this.n && s[j] !== "'") {
          if (s[j] === '\\' && j + 1 < this.n) {
            out += s[j + 1];
            j += 2;
          } else {
            out += s[j];
            j += 1;
          }
        }
        if (j >= this.n) throw new ShellParseError("chaîne $'…' non refermée");
        const w = ensure();
        w.quoted = true;
        addLit(w, out);
        w.unq += 'Q';
        this.i = j + 1;
        continue;
      }
      if (c === '"' || (c === '$' && next === '"')) {
        if (c === '$') this.i += 1;
        const w = ensure();
        w.quoted = true;
        w.unq += 'Q';
        for (const part of this.parseDouble()) addPart(w, part);
        continue;
      }
      if (c === '$' || c === '`') {
        const part = this.parseDollar();
        if (part) {
          addPart(ensure(), part);
          continue;
        }
      }
      if (c === '#' && word === null) {
        const e = s.indexOf('\n', this.i);
        this.i = e < 0 ? this.n : e;
        continue;
      }
      if (
        c === '~' &&
        (word === null || (isLiteral(word) && /^[A-Za-z_][A-Za-z0-9_]*=$/.test(wordText(word)))) &&
        (next === undefined || next === '/' || /[\s;&|<>()]/.test(next))
      ) {
        addPart(ensure(), { t: 'var', name: 'HOME', raw: '~' });
        this.i += 1;
        continue;
      }
      if (c === '\n') {
        endSegment();
        this.i += 1;
        this.readHeredocBodies();
        continue;
      }
      if (c === ' ' || c === '\t') {
        pushWord();
        this.i += 1;
        continue;
      }
      if (c === ';') {
        endSegment();
        let k = 1;
        if (next === ';') k = s[this.i + 2] === '&' ? 3 : 2;
        else if (next === '&') k = 2;
        this.i += k;
        if (k > 1 && top()?.phase === 'body') top().phase = 'pattern';
        continue;
      }
      if (c === '(') {
        if (
          word !== null &&
          isLiteral(word) &&
          /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=$/.test(wordText(word))
        ) {
          // Tableau : x=(a b $(…)).
          this.i += 1;
          this.parseList(')', 'data');
          addPart(word, { t: 'dyn', raw: '(…)' });
          continue;
        }
        if (
          pending === null &&
          seg.kind === 'command' &&
          seg.words.length + (word === null ? 0 : 1) <= 1 &&
          /^\(\s*\)/.test(s.slice(this.i, this.i + 64))
        ) {
          // nom() { … }, function nom() { … }, () { … } (zsh) : définition de fonction ; le corps
          // qui suit est analysé comme s'il était exécuté.
          pushWord();
          seg.words = [];
          this.i = s.indexOf(')', this.i) + 1;
          continue;
        }
        if (word !== null) {
          throw new ShellParseError(
            `parenthèse collée à un mot (${wordText(word)}( : motif étendu ou qualificatif de glob)`,
          );
        }
        if (pending !== null) throw new ShellParseError('redirection suivie d’une parenthèse');
        if (seg.words.length === 0 && top()?.phase === 'pattern') {
          this.i += 1; // ( facultative devant un motif de case
          continue;
        }
        if (next === '(' && (seg.words.length === 0 || seg.kind === 'data')) {
          const start = this.i;
          const outLen = this.out.length;
          const heredocs = this.heredocs.length;
          this.i += 2;
          if (this.scanArithmetic()) continue; // (( … )) : commande arithmétique, for ((…))
          this.out.length = outLen;
          this.heredocs.length = heredocs;
          this.i = start;
        }
        if (seg.words.length === 0 || seg.kind === 'data') {
          const data = seg.kind === 'data';
          this.i += 1;
          this.out.push(ENTER);
          this.parseList(')', data ? 'data' : 'command');
          this.out.push(LEAVE);
          if (data) endSegment(); // zsh : for i (1 2) commande
          continue;
        }
        throw new ShellParseError('parenthèse inattendue après une commande');
      }
      if (c === ')') {
        if (top()?.phase === 'pattern') {
          endSegment();
          top().phase = 'body';
          this.i += 1;
          continue;
        }
        if (end === ')') {
          endSegment();
          if (cases.length > 0) throw new ShellParseError('case sans esac');
          this.i += 1;
          return;
        }
        throw new ShellParseError('parenthèse fermante sans ouvrante');
      }
      if (c === '|') {
        this.i += next === '|' || next === '&' ? 2 : 1;
        endSegment(next !== '|');
        continue;
      }
      if (c === '&') {
        if (next === '>') {
          pushWord();
          if (pending !== null) throw new ShellParseError('redirection sans cible');
          this.i += 2;
          if (s[this.i] === '>') this.i += 1;
          if (s[this.i] === '|' || s[this.i] === '!') this.i += 1;
          pending = 'redirect';
          continue;
        }
        endSegment();
        this.i += next === '&' || next === '|' || next === '!' ? 2 : 1;
        continue;
      }
      if ((c === '<' || c === '>' || (c === '=' && word === null)) && next === '(') {
        // Substitution de processus <(…), >(…) et =(…) de zsh.
        pushWord();
        const w = newWord();
        w.procsub = true;
        this.i += 2;
        this.out.push(ENTER);
        this.parseList(')');
        this.out.push(LEAVE);
        w.parts.push({ t: 'dyn', raw: `${c}(…)` });
        word = w;
        continue;
      }
      if (c === '<' || c === '>') {
        // Un descripteur collé à la redirection (2>…, {fd}>…) n'est pas un mot.
        if (
          word !== null &&
          isLiteral(word) &&
          /^(\d+|\{[A-Za-z_][A-Za-z0-9_]*\})$/.test(wordText(word))
        ) {
          word = null;
        } else pushWord();
        if (pending !== null) throw new ShellParseError('redirection sans cible');
        if (c === '<') {
          if (next === '<' && s[this.i + 2] === '<') {
            this.i += 3;
            pending = 'herestring';
          } else if (next === '<') {
            this.i += 2;
            let strip = false;
            if (s[this.i] === '-') {
              strip = true;
              this.i += 1;
            }
            pending = { strip };
          } else if (next === '>') {
            this.i += 2;
            pending = 'redirect';
          } else if (next === '&') {
            let j = this.i + 2;
            while (j < this.n && /[^\s;&|<>()]/.test(s[j])) j += 1;
            this.i = j;
          } else {
            this.i += 1;
            pending = 'input';
          }
          continue;
        }
        this.i += 1;
        if (s[this.i] === '>') this.i += 1;
        if (s[this.i] === '|' || s[this.i] === '!') this.i += 1;
        if (s[this.i] === '&') {
          // >&2, 2>&1, >&- : duplication de descripteur, pas une écriture de fichier.
          let j = this.i + 1;
          while (j < this.n && /[^\s;&|<>()]/.test(s[j])) j += 1;
          const dup = s.slice(this.i + 1, j);
          if (!/^(\d+|-)$/.test(dup)) {
            const w = newWord();
            addLit(w, dup);
            seg.redirects.push(w);
          }
          this.i = j;
          continue;
        }
        pending = 'redirect';
        continue;
      }
      const w = ensure();
      addLit(w, c);
      w.unq += c;
      this.i += 1;
    }
    endSegment();
    if (end === ')') throw new ShellParseError('parenthèse non refermée');
    if (cases.length > 0) throw new ShellParseError('case sans esac');
  }
}

/**
 * Lit la commande : liste de segments `{ words, redirects, inputs, heredoc, kind, pipedIn… }` dont
 * les mots sont des objets `{ parts, quoted, procsub }`, et de marqueurs ENTER et LEAVE autour des
 * sous-shells et substitutions. Lève ShellParseError sur une syntaxe incomplète ou inconnue.
 */
export function parseShell(command) {
  const out = [];
  const parser = new ShellParser(command, out, 0);
  parser.parseList(null);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Résolution des mots

const UNSAFE_VALUE = /[\s*?[\]{}~$`\\'"]/;

/**
 * Valeur d'un mot, ou texte préfixé d'UNKNOWN s'il n'est pas lisible : la partie littérale qui
 * précède reste en clair (une affectation x=$(…) reste reconnaissable comme affectation).
 */
function resolveWord(w, st) {
  // <(…), >(…) et =(…) deviennent un chemin de tube (/dev/fd/N) ou un fichier temporaire.
  if (w.procsub) return '/dev/fd/63';
  let out = '';
  for (let k = 0; k < w.parts.length; k += 1) {
    const p = w.parts[k];
    if (p.t === 'lit') {
      out += p.v;
      continue;
    }
    if (p.t === 'var') {
      let value = null;
      if (st.vars.has(p.name)) value = st.vars.get(p.name);
      else if (p.name === 'HOME') value = process.env.HOME ?? null;
      else if (p.name === 'PWD') value = st.base;
      if (typeof value === 'string' && !UNSAFE_VALUE.test(value)) {
        out += value;
        continue;
      }
    }
    return `${out}${UNKNOWN}${w.parts.slice(k).map(partText).join('')}`;
  }
  return out;
}

/** Texte d'un mot résolu pour un message (sans le marqueur d'illisibilité). */
function shown(text) {
  return text.split(UNKNOWN).join('');
}

/** Protège un mot pour le recoller dans un code shell analysé à nouveau. */
function quote(text) {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

// ---------------------------------------------------------------------------------------------
// Enveloppes

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;
const SIMPLE_WRAPPERS = new Set([
  'builtin',
  'nohup',
  'noglob',
  'nocorrect',
  '-',
  'chronic',
  'unbuffer',
]);
const OPTION_WRAPPERS = {
  command: new Set([]),
  exec: new Set(['-a']),
  time: new Set(['-f', '-o', '--format', '--output']),
  sudo: new Set(['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U']),
  doas: new Set(['-u', '-C']),
  env: new Set(['-u', '-C', '--unset', '--chdir']),
  nice: new Set(['-n', '--adjustment']),
  stdbuf: new Set(['-i', '-o', '-e']),
  timeout: new Set(['-k', '-s', '--kill-after', '--signal']),
  ionice: new Set(['-c', '-n', '-p']),
  setsid: new Set([]),
};
const XARGS_WRITERS = new Set([
  'rm',
  'rmdir',
  'unlink',
  'shred',
  'truncate',
  'touch',
  'chmod',
  'chown',
  'mv',
  'cp',
  'install',
  'ln',
  'tee',
  'dd',
  'sed',
  'gsed',
  'perl',
  'ruby',
  'awk',
  'gawk',
  'git',
  'patch',
]);
const XARGS_VALUE_OPTIONS = new Set([
  '-I',
  '-i',
  '-n',
  '-P',
  '-d',
  '-L',
  '-s',
  '-a',
  '-E',
  '-e',
  '--arg-file',
  '--delimiter',
]);
/** Gestionnaires de paquets dont « exec », « x » ou « dlx » lance une commande. */
const PACKAGE_MANAGERS = new Set(['pnpm', 'npm', 'yarn', 'bun']);
const PACKAGE_VALUED = new Set([
  '-C',
  '--dir',
  '--cwd',
  '--prefix',
  '--filter',
  '-F',
  '--filter-prod',
  '--reporter',
  '--loglevel',
  '-p',
  '--package',
  '--workspace',
]);
const SHELL_MODE = new Set(['-c', '--call', '--shell-mode']);

/** Commande lancée par un gestionnaire de paquets (exec, npx…) : mots ou code shell. */
function packageCommand(rest) {
  if (rest.some((a) => SHELL_MODE.has(a) || a.startsWith('--call='))) {
    const code = rest
      .filter((a) => !SHELL_MODE.has(a))
      .map((a) => (a.startsWith('--call=') ? a.slice(7) : a))
      .filter((a) => !a.startsWith('-'));
    return { code: code.join(' ') };
  }
  let j = 0;
  while (j < rest.length && rest[j].startsWith('-')) {
    if (rest[j] === '--') {
      j += 1;
      break;
    }
    if (PACKAGE_VALUED.has(rest[j])) j += 1;
    j += 1;
  }
  return { words: rest.slice(j) };
}

/**
 * Retire affectations de variables et enveloppes (sudo, env, timeout, xargs, pnpm exec…) en tête de
 * segment. `code` : code shell que l'enveloppe fait exécuter (env -S, watch, flock -c, npx -c…).
 */
function unwrap(words) {
  let w = [...words];
  let viaXargs = false;
  const assignments = [];
  for (let guard = 0; guard < 30 && w.length > 0; guard += 1) {
    if (ASSIGNMENT.test(w[0])) {
      assignments.push(w.shift());
      continue;
    }
    const name = basename(w[0]);
    if (SIMPLE_WRAPPERS.has(name)) {
      w.shift();
      continue;
    }
    if (name === 'xargs') {
      viaXargs = true;
      w.shift();
      while (w.length > 0 && w[0].startsWith('-')) {
        const opt = w.shift();
        if (XARGS_VALUE_OPTIONS.has(opt)) w.shift();
      }
      continue;
    }
    if (name === 'env') {
      w.shift();
      while (w.length > 0 && (w[0].startsWith('-') || ASSIGNMENT.test(w[0]))) {
        const opt = w.shift();
        if (opt === '-S' || opt === '--split-string')
          return {
            words: [],
            viaXargs,
            assignments,
            code: [w.shift() ?? '', ...w.map(quote)].join(' '),
          };
        if (opt.startsWith('--split-string='))
          return {
            words: [],
            viaXargs,
            assignments,
            code: [opt.slice(15), ...w.map(quote)].join(' '),
          };
        if (/^-[^-]*S/.test(opt)) {
          const value = opt.slice(opt.indexOf('S') + 1) || (w.shift() ?? '');
          return { words: [], viaXargs, assignments, code: [value, ...w.map(quote)].join(' ') };
        }
        if (ASSIGNMENT.test(opt)) assignments.push(opt);
        else if (OPTION_WRAPPERS.env.has(opt)) w.shift();
      }
      continue;
    }
    if (name === 'watch') {
      // watch passe sa commande à sh -c.
      w.shift();
      while (w.length > 0 && w[0].startsWith('-')) {
        const opt = w.shift();
        if (['-n', '--interval', '-g', '-q'].includes(opt)) w.shift();
      }
      return { words: [], viaXargs, assignments, code: w.join(' ') };
    }
    if (name === 'flock') {
      w.shift();
      let code = null;
      const rest = [];
      while (w.length > 0) {
        const a = w.shift();
        if (a === '-c' || a === '--command') code = w.shift() ?? '';
        else if (['-w', '--timeout', '-E', '--conflict-exit-code'].includes(a)) w.shift();
        else if (a.startsWith('-') && rest.length === 0) continue;
        else rest.push(a);
      }
      if (code !== null) return { words: [], viaXargs, assignments, code };
      w = rest.slice(1); // le premier opérande est le fichier verrou
      continue;
    }
    if (['su', 'runuser', 'script'].includes(name) && w.includes('-c')) {
      return { words: [], viaXargs, assignments, code: w[w.indexOf('-c') + 1] ?? '' };
    }
    if (PACKAGE_MANAGERS.has(name)) {
      let k = 1;
      while (k < w.length && w[k].startsWith('-')) {
        if (PACKAGE_VALUED.has(w[k])) k += 1;
        k += 1;
      }
      if (['exec', 'x', 'dlx'].includes(w[k])) {
        const r = packageCommand(w.slice(k + 1));
        if (r.code !== undefined) return { words: [], viaXargs, assignments, code: r.code };
        w = r.words;
        continue;
      }
      break;
    }
    if (['npx', 'pnpx', 'bunx'].includes(name)) {
      const r = packageCommand(w.slice(1));
      if (r.code !== undefined) return { words: [], viaXargs, assignments, code: r.code };
      w = r.words;
      continue;
    }
    if (OPTION_WRAPPERS[name]) {
      const valued = OPTION_WRAPPERS[name];
      w.shift();
      while (w.length > 0 && w[0].startsWith('-')) {
        const opt = w.shift();
        if (opt === '--') break;
        if (valued.has(opt)) w.shift();
      }
      if (name === 'timeout' && w.length > 0) w.shift(); // durée
      continue;
    }
    break;
  }
  return { words: w, viaXargs, assignments, code: null };
}

/** Arguments qui ne sont pas des options ; `valued` liste les options suivies d'une valeur. */
function operands(args, valued = new Set()) {
  const out = [];
  let endOfOptions = false;
  for (let k = 0; k < args.length; k += 1) {
    const a = args[k];
    if (endOfOptions) {
      out.push(a);
    } else if (a === '--') {
      endOfOptions = true;
    } else if (a.startsWith('-') && a !== '-') {
      if (valued.has(a)) k += 1;
    } else {
      out.push(a);
    }
  }
  return out;
}

function valueOf(args, names) {
  const out = [];
  for (let k = 0; k < args.length; k += 1) {
    const a = args[k];
    for (const name of names) {
      if (a === name && k + 1 < args.length) out.push(args[k + 1]);
      else if (name.startsWith('--') && a.startsWith(`${name}=`))
        out.push(a.slice(name.length + 1));
    }
  }
  return out;
}

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'mksh', 'fish']);
const INTERPRETERS = new Set([
  'python',
  'python2',
  'python3',
  'node',
  'nodejs',
  'deno',
  'bun',
  'ruby',
  'perl',
  'php',
  'tsx',
  'ts-node',
  'pwsh',
  'osascript',
  'source',
  '.',
  ...SHELLS,
]);
const INLINE_FLAGS = new Set(['-c', '-e', '-E', '-p', '-r', '--eval', '--print', '-x']);
const INTERPRETER_VALUED = new Set([
  '-m',
  '-W',
  '-X',
  '-r',
  '--require',
  '--import',
  '--loader',
  '--experimental-loader',
  '-I',
  '-M',
  '-o',
  '-O',
]);
/** Options qui n'exécutent aucun code (version, aide). */
const INFO_FLAGS = new Set(['--version', '-v', '-V', '--help', '-h']);
/** Primitives d'écriture repérées dans un code opaque (script, code en ligne, here-document). */
const WRITE_PRIMITIVES =
  /writeFile|appendFile|createWriteStream|copyFile|cpSync|renameSync|\brename\(|unlink|rmSync|rmdir|truncate|\.write\(|write_text|write_bytes|shutil\.|os\.remove|os\.replace|open\([^)]*['"][wax+]|execSync|execFile|spawn|child_process|subprocess|system\(|\bsed\s+-i|\btee\b|>\s*[^\s&]|\bgit\s+(checkout|restore|rm|mv|apply|update-index)\b|\b(rm|mv|cp)\s/;
/** Variables d'environnement dont la valeur est une commande lancée par git ou le shell. */
const COMMAND_ENV = new Set([
  'GIT_EDITOR',
  'GIT_SEQUENCE_EDITOR',
  'GIT_PAGER',
  'PAGER',
  'EDITOR',
  'VISUAL',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_ASKPASS',
  'SSH_ASKPASS',
  'GIT_EXTERNAL_DIFF',
  'GIT_PROXY_COMMAND',
]);
/** Variables qui font charger un fichier de code au démarrage d'un interpréteur : illisible. */
const CODE_FILE_ENV = new Set(['BASH_ENV', 'ENV', 'ZDOTDIR', 'LD_PRELOAD', 'PERL5OPT', 'RUBYOPT']);
const DEV_FILES = new Set(['/dev/null', '/dev/stdout', '/dev/stderr', '/dev/tty']);
const SCRIPT_LIMIT = 512 * 1024;

/** Contenu d'un fichier lisible (fichier ordinaire, 512 Ko au plus), ou null. */
function readSmallFile(path) {
  try {
    if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size > SCRIPT_LIMIT)
      return null;
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Fichiers désignés par un chemin de script ; motif admis dans le dernier segment seulement. */
function scriptFiles(abs) {
  if (!/[*?[]/.test(abs)) return [abs];
  if (/[*?[]/.test(dirname(abs))) return null;
  const re = new RegExp(
    `^${basename(abs)
      .replace(/[.+^${}()|\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')}$`,
  );
  try {
    const found = readdirSync(dirname(abs))
      .filter((f) => re.test(f))
      .map((f) => join(dirname(abs), f));
    return found.length > 0 ? found : null;
  } catch {
    return null;
  }
}

/** Chemins modifiés par un patch unifié (lignes --- a/ et +++ b/). */
export function patchPaths(text) {
  const out = new Set();
  for (const m of text.matchAll(/^(?:\+\+\+|---) (?:[ab]\/)?(\S+)/gm)) {
    if (m[1] !== '/dev/null') out.add(m[1]);
  }
  return [...out];
}

/** Vrai si le chemin désigne un script des garde-fous (.claude/hooks/), réservé à la session principale. */
function isGuardScript(path, base) {
  return /(^|\/)\.claude\/hooks\//.test(resolve(base, path));
}

/** Une ligne de code opaque qui lance git push (shell, sous-processus, tableau d'arguments). */
const PUSH_IN_CODE = /\bgit\b[^\n]*\bpush\b/;
/** Adresse sed facultative (ligne, $, /motif/) et plage. */
const SED_ADDR = String.raw`(?:[0-9$]+|\/[^/\n]*\/)?(?:,(?:[0-9$]+|\/[^/\n]*\/))?`;
/** Commande sed w FICHIER, ou drapeau w de s///. */
const SED_WRITE = new RegExp(
  String.raw`(?:^|[;{}\n])\s*${SED_ADDR}\s*[wW]\s+([^\n;}]+)|\bs([^\w\s])(?:(?!\2).)*\2(?:(?!\2).)*\2[gpIiMme0-9]*w\s+([^\n;}]+)`,
  'g',
);
/** Commande sed e (GNU), ou drapeau e de s/// : exécute du shell. */
const SED_EXEC = new RegExp(
  String.raw`(?:^|[;{}\n])\s*${SED_ADDR}\s*e(?:\s|$)|\bs([^\w\s])(?:(?!\1).)*\1(?:(?!\1).)*\1[gpIiMmw0-9]*e`,
);

/**
 * Analyse une commande. `cwd` est le dossier courant de l'agent (entrée du hook), ou null s'il
 * n'est pas lisible (code imbriqué après un cd calculé) ; `role` son rôle (« main » pour la
 * session principale), qui décide seul du droit de push ; `scratch` le dossier temporaire de la
 * session (champ scratchpad_dir de l'entrée du hook, ou null), seule destination de
 * `gh run download` avec les dossiers temporaires de session reconnus (L22-05).
 * Résultat :
 * - deny      : raison d'un refus inconditionnel (ou null) ;
 * - targets   : [{ path, base }] cibles d'écriture explicites, à classer par l'appelant ;
 * - repoTargets : [{ path, base }] chemins relatifs à la racine du dépôt (patch git) ;
 * - opaque    : [{ what, text, base }] écritures dont la cible n'est pas lisible ;
 * - scripts   : [{ path, base }] scripts exécutés (pour repérer les scripts des garde-fous) ;
 * - writes    : vrai si la commande écrit quelque chose (pour les marqueurs dans le texte).
 */
export function analyzeCommand(
  command,
  cwd,
  role = null,
  { depth = 0, fallback = null, vars = null, heads = null, scratch = null, configSeen = null } = {},
) {
  if (depth > MAX_DEPTH) throw new ShellParseError('imbrication trop profonde (code dans du code)');
  const result = {
    deny: null,
    targets: [],
    repoTargets: [],
    opaque: [],
    scripts: [],
    writes: false,
  };
  const items = parseShell(command);
  const home = fallback ?? cwd ?? process.cwd();
  // heads : branche courante de chaque dépôt changée par la commande (checkout, switch, worktree
  // add…), partagée avec le code imbriqué et jamais restaurée en sortie de sous-shell (L14-06).
  const st = {
    base: cwd,
    vars: new Map(vars ?? []),
    written: new Set(),
    gitEnv: [],
    heads: heads ?? new Map(),
    // L25-01 : entrées de configuration de l'environnement déjà analysées (variable, clé, valeur),
    // partagées avec le code imbriqué (qui hérite des variables) : chacune ne l'est qu'une fois.
    configSeen: configSeen ?? new Set(),
  };
  const scopes = [];
  // Le dernier motif l'emporte, sauf un motif « faible » (illisibilité générique), qui ne remplace
  // pas un motif déjà trouvé plus précis.
  const deny = (reason, { weak = false } = {}) => {
    if (!weak || result.deny === null) result.deny = reason;
  };
  /** Chemin absolu d'un mot lisible relatif à `base`, sinon null et un refus. */
  const readable = (path, what, base = st.base) => {
    if (path.includes(UNKNOWN)) {
      deny(
        `${what} illisible (${shown(path)}) : variable inconnue, substitution ou expansion ; ` +
          'illisible, donc refusé — écris le chemin en clair',
      );
      return null;
    }
    if (base === null && !isAbsolute(path)) {
      deny(
        `${what} ${path} relatif à un dossier courant illisible (cd vers un chemin calculé) : ` +
          'illisible, donc refusé',
      );
      return null;
    }
    return resolve(base ?? home, path);
  };
  const target = (path, b = st.base) => {
    if (readable(path, "cible d'écriture", b) === null) return;
    result.targets.push({ path, base: b ?? home });
    result.writes = true;
    st.written.add(resolve(b ?? home, path));
  };
  // `script` : chemin du script lu, le cas échéant ; ceux des garde-fous (tests des hooks compris)
  // citent git push sans le lancer et ne sont lancés que par la session principale.
  const opaque = (what, text, b = st.base, script = null, writes = true) => {
    const base = b ?? home;
    result.opaque.push({ what, text, base });
    if (writes) result.writes = true;
    if (PUSH_IN_CODE.test(text) && !(script !== null && isGuardScript(script, base))) {
      deny(
        `git push dans du code opaque (${what}) : la branche et le remote ne sont pas vérifiables ; ` +
          'seule la session principale pousse, par une commande git push origin develop ou git push -u origin lot/<nom> écrite telle quelle',
      );
    }
  };
  const merge = (sub) => {
    if (sub.deny) deny(sub.deny);
    result.targets.push(...sub.targets);
    result.repoTargets.push(...sub.repoTargets);
    result.opaque.push(...sub.opaque);
    result.scripts.push(...sub.scripts);
    result.writes ||= sub.writes;
  };
  // Code shell exécuté plus loin (sh -c, eval, alias, trap, env -S, watch…) : analysé comme une
  // commande, puis comme code opaque (git push n'y est jamais permis).
  const nested = (what, code, b = st.base) => {
    if (code.includes(UNKNOWN)) {
      deny(`code shell calculé (${what} ${shown(code)}) : illisible, donc refusé`);
      return;
    }
    // Les variables connues sont transmises : surestimation prudente pour sh -c (seules les
    // variables exportées y passent), exacte pour eval, trap et les alias.
    merge(
      analyzeCommand(code, b, role, {
        depth: depth + 1,
        fallback: home,
        vars: st.vars,
        heads: st.heads,
        scratch,
        configSeen: st.configSeen,
      }),
    );
    opaque(what, code, b);
  };
  const env = {
    command,
    st,
    cwd: home,
    role,
    scratch,
    result,
    deny,
    target,
    opaque,
    nested,
    readable,
  };

  for (const item of items) {
    if (item === ENTER) {
      scopes.push({ base: st.base, vars: new Map(st.vars) });
      continue;
    }
    if (item === LEAVE) {
      // L25-01 : une clé GIT_CONFIG_KEY_<n> du sous-shell sans valeur lisible n'en sort pas.
      checkEnvConfig(env, st.vars, true);
      const scope = scopes.pop();
      st.base = scope.base;
      st.vars = scope.vars;
      continue;
    }
    analyzeSegment(item, env);
  }
  checkEnvConfig(env, st.vars, true);
  return result;
}

function analyzeSegment(seg, env) {
  const { st, deny, target, opaque, nested } = env;
  const word = (w) => resolveWord(w, st);
  for (const r of seg.redirects) {
    const p = word(r);
    if (!DEV_FILES.has(p) && !p.startsWith('/dev/fd/')) target(p);
  }
  const words = seg.words.map(word);
  if (seg.kind === 'data') {
    if (['for', 'select', 'foreach'].includes(seg.header) && words[1]) st.vars.set(words[1], null);
    return;
  }
  if (words.length > 0 && words.every((x) => ASSIGNMENT.test(x))) {
    // Affectations seules : variables du shell, résolues plus loin dans la même commande.
    words.forEach((a) => assignVar(env, a));
    return;
  }
  const { words: w, viaXargs, assignments, code } = unwrap(words);
  for (const a of assignments) {
    const name = a.slice(0, a.indexOf('='));
    const value = a.slice(a.indexOf('=') + 1);
    if (name === 'HUSKY' && (value === '0' || value.includes(UNKNOWN)))
      deny(`désactiver husky (${shown(a)}) est interdit`);
    gitConfigEnv(env, name, value, true);
    allowProtocolEnv(env, name, value, true);
    if (CODE_FILE_ENV.has(name))
      deny(`variable ${name} : elle fait charger un code au démarrage ; illisible, donc refusée`);
    if (
      name === 'NODE_OPTIONS' &&
      /--(require|import|loader|experimental-loader)\b|(^|\s)-r\b/.test(value)
    )
      deny('NODE_OPTIONS qui charge un module : code illisible, donc refusé');
    if (COMMAND_ENV.has(name) && value !== '') nested(`variable ${name}`, value);
  }
  // L25-01 : configuration de l'environnement de cette commande seule (variables de la commande
  // sur celles du shell) ; une clé sans valeur lisible n'en recevra pas plus loin.
  if (assignments.some((a) => GIT_CONFIG_ENV.test(a.slice(0, a.indexOf('='))))) {
    checkEnvConfig(env, overlayVars(st.vars, assignments), true);
  }
  if (code !== null) {
    nested('commande enveloppée', code);
    return;
  }
  if (w.length === 0) return;
  let head = w[0];
  if (head.includes(UNKNOWN)) {
    deny(
      `nom de commande illisible (${shown(head)}) : variable, substitution ou expansion à la place ` +
        'du programme ; illisible, donc refusé — écris la commande en clair',
      { weak: true },
    );
    return;
  }
  if (head.length > 1 && head.startsWith('=')) head = head.slice(1); // zsh : =git
  let cmd = basename(head);
  let args = w.slice(1);
  // Exécutable git-<commande> appelé directement (git-send-pack, /usr/lib/git-core/git-push…).
  let dashed = false;
  const plumbing = /^git-([a-z][a-z0-9-]*)$/.exec(cmd);
  if (plumbing) {
    args = [plumbing[1], ...args];
    cmd = 'git';
    dashed = true;
  }

  if (viaXargs && (XARGS_WRITERS.has(cmd) || INTERPRETERS.has(cmd))) {
    // Les arguments viennent de l'entrée standard : la cible est illisible.
    opaque(`xargs ${cmd}`, env.command);
  }
  if (args.includes('--update') || (args.includes('-u') && /vitest|^test/.test(words.join(' ')))) {
    deny('mettre à jour les instantanés de test (vitest -u) affaiblit un oracle');
  }

  switch (cmd) {
    case 'cd':
    case 'pushd': {
      const d = operands(args)[0];
      if (d === undefined) st.base = process.env.HOME ?? null;
      else if (d === '-' || d.includes(UNKNOWN) || (st.base === null && !isAbsolute(d)))
        st.base = null;
      else st.base = resolve(st.base, d);
      break;
    }
    case 'popd':
      st.base = null;
      break;
    case 'export':
    case 'declare':
    case 'typeset':
    case 'local':
    case 'readonly': {
      // declare -n R=<nom> : R désigne la variable <nom>, que R=… affecte ensuite (L19-02).
      const nameref = args.some((a) => /^-[a-zA-Z]*n/.test(a));
      for (const a of args) {
        if (ASSIGNMENT.test(a)) {
          assignVar(env, a);
          const target = a.slice(a.indexOf('=') + 1);
          if (nameref) gitConfigEnv(env, target, UNKNOWN, false);
        } else if (/^GIT_/.test(a)) st.gitEnv.push(a);
      }
      break;
    }
    case 'unset':
    case 'read':
    case 'mapfile':
    case 'readarray':
    case 'getopts':
      for (const a of operands(
        args,
        new Set(['-d', '-n', '-N', '-p', '-t', '-u', '-C', '-c', '-O', '-s']),
      )) {
        st.vars.set(a, null);
        // Valeur lue à l'exécution : une variable GIT_CONFIG_* ainsi affectée est illisible.
        if (cmd !== 'unset') gitConfigEnv(env, a, UNKNOWN, false);
      }
      break;
    case 'printf':
      // printf -v <variable> : affectation calculée (L19-02).
      for (let j = 0; j < args.length && args[j].startsWith('-'); j += 1) {
        const a = args[j];
        const name = a === '-v' ? args[(j += 1)] : /^-v./.test(a) ? a.slice(2) : undefined;
        if (name !== undefined) {
          st.vars.set(name, null);
          gitConfigEnv(env, name, UNKNOWN, false);
        }
      }
      break;
    case 'alias':
      for (const a of args) {
        const k = a.indexOf('=');
        if (k > 0) nested(`alias ${a.slice(0, k)}`, a.slice(k + 1));
      }
      break;
    case 'trap':
      if (args[0] && !args[0].startsWith('-')) nested('trap', args[0]);
      break;
    case 'eval':
      nested('eval', args.join(' '));
      break;
    case 'rm':
    case 'rmdir':
    case 'unlink':
    case 'shred':
    case 'touch':
      operands(args, new Set(['-r', '-d', '-t', '--reference'])).forEach((p) => target(p));
      break;
    case 'truncate':
      operands(args, new Set(['-s', '--size', '-r', '--reference'])).forEach((p) => target(p));
      break;
    case 'chmod':
    case 'chown':
    case 'chgrp':
      operands(args, new Set(['--reference']))
        .slice(1)
        .forEach((p) => target(p));
      break;
    case 'mv':
      operands(args, new Set(['-t', '--target-directory', '-S', '--suffix'])).forEach((p) =>
        target(p),
      );
      valueOf(args, ['-t', '--target-directory']).forEach((p) => target(p));
      break;
    case 'cp':
    case 'install':
    case 'ln':
    case 'rsync':
    case 'scp': {
      const ops = operands(
        args,
        new Set(['-t', '--target-directory', '-m', '--mode', '-o', '-g', '-S', '-e']),
      );
      const dirs = valueOf(args, ['-t', '--target-directory']);
      if (dirs.length > 0) dirs.forEach((p) => target(p));
      else if (ops.length >= 2) target(ops[ops.length - 1]);
      else if (ops.length === 1 && cmd === 'ln') target(ops[0]);
      break;
    }
    case 'tee':
      operands(args).forEach((p) => target(p));
      break;
    case 'dd':
      args.filter((a) => a.startsWith('of=')).forEach((a) => target(a.slice(3)));
      break;
    case 'sed':
    case 'gsed': {
      const inPlace = args.some((a) => /^-[^-]*i/.test(a) || a.startsWith('--in-place'));
      const hasScriptOption = args.some((a) => ['-e', '-f', '--expression', '--file'].includes(a));
      const ops = operands(
        args,
        new Set(['-e', '-f', '--expression', '--file', '-l', '--line-length']),
      );
      if (inPlace) (hasScriptOption ? ops : ops.slice(1)).forEach((p) => target(p));
      // Script sed : la commande w (et le drapeau s///w) écrit un fichier, la commande e (et le
      // drapeau s///e) de GNU sed exécute du shell.
      const script = (
        hasScriptOption ? valueOf(args, ['-e', '--expression']) : ops.slice(0, 1)
      ).join('\n');
      for (const m of script.matchAll(SED_WRITE)) target((m[1] ?? m[3]).trim());
      if (SED_EXEC.test(script) && PUSH_IN_CODE.test(script))
        deny(
          `git push dans un script ${cmd} (commande e) : seule la session principale pousse, par ` +
            'git push origin develop ou git push -u origin lot/<nom> écrite telle quelle',
        );
      break;
    }
    case 'perl':
    case 'ruby': {
      const inPlace = args.some((a) => /^-[a-zA-Z0-9]*i/.test(a));
      const hasInline = args.some((a) => /^-[a-zA-Z0-9]*[eE]$/.test(a));
      const ops = operands(args, new Set(['-e', '-E', '-M', '-I', '-m', '-r']));
      if (inPlace) (hasInline ? ops : ops.slice(1)).forEach((p) => target(p));
      if (hasInline) {
        if (args.some((a) => a.includes(UNKNOWN)))
          deny(`code en ligne calculé (${cmd}) : illisible, donc refusé`);
        opaque(cmd, `${args.join(' ')}\n${seg.heredoc}`);
      } else if (!inPlace && ops[0]) {
        runScript(env, cmd, ops[0], seg);
      } else if (!inPlace) {
        stdinCode(env, cmd, args, seg);
      }
      break;
    }
    case 'awk':
    case 'gawk':
    case 'mawk':
    case 'nawk': {
      const inPlace = args.some(
        (a, k) => (a === '-i' && args[k + 1] === 'inplace') || a === '--include=inplace',
      );
      const hasFile = args.includes('-f');
      const ops = operands(args, new Set(['-i', '-f', '-v', '-F', '--include']));
      if (inPlace) (hasFile ? ops : ops.slice(1)).forEach((p) => target(p));
      // Programme awk : print > "fichier" et system() écrivent ou lancent du code.
      const program = hasFile
        ? valueOf(args, ['-f'])
            .map((f) => readSmallFile(resolve(st.base ?? env.cwd, f)) ?? '')
            .join('\n')
        : (ops[0] ?? '');
      opaque(cmd, program, st.base, null, WRITE_PRIMITIVES.test(program));
      break;
    }
    case 'ed':
    case 'ex':
    case 'vi':
    case 'vim':
    case 'nvim':
    case 'nano':
    case 'emacs':
      operands(args, new Set(['-c', '-s', '-u'])).forEach((p) => target(p));
      break;
    case 'curl':
      valueOf(args, ['-o', '--output']).forEach((p) => target(p));
      if (args.includes('-O') || args.includes('--remote-name')) target('.');
      break;
    case 'wget':
      valueOf(args, ['-O', '--output-document', '-P', '--directory-prefix']).forEach((p) =>
        target(p),
      );
      break;
    case 'tar':
    case 'bsdtar': {
      const extract = args.some(
        (a) => a === '--extract' || a === '--get' || /^-?[a-zA-Z]*x/.test(a),
      );
      if (extract) {
        const dirs = valueOf(args, ['-C', '--directory']);
        (dirs.length > 0 ? dirs : ['.']).forEach((p) => target(p));
      }
      break;
    }
    case 'unzip': {
      const dirs = valueOf(args, ['-d']);
      (dirs.length > 0 ? dirs : ['.']).forEach((p) => target(p));
      break;
    }
    case 'find': {
      const acting = args.some((a) =>
        [
          '-delete',
          '-exec',
          '-execdir',
          '-ok',
          '-okdir',
          '-fprint',
          '-fprint0',
          '-fprintf',
          '-fls',
        ].includes(a),
      );
      if (acting) {
        const roots = [];
        for (const a of args) {
          if (a.startsWith('-') || a === '(' || a === '!') break;
          roots.push(a);
        }
        (roots.length > 0 ? roots : ['.']).forEach((p) => target(p));
        opaque('find', args.join(' '));
      }
      break;
    }
    case 'patch': {
      const files = valueOf(args, ['-i', '--input']);
      const text =
        files.map((f) => readSmallFile(resolve(st.base ?? env.cwd, f)) ?? '').join('\n') +
        seg.heredoc;
      if (text.trim() === '') opaque('patch', env.command);
      patchPaths(text).forEach((p) => target(p));
      operands(args, new Set(['-i', '--input', '-p', '-d', '-o', '--output', '-r'])).forEach((p) =>
        target(p),
      );
      break;
    }
    case 'git':
      analyzeGit(args, env, seg, { assignments, dashed, viaXargs });
      break;
    case 'gh':
      analyzeGh(args, env, { assignments, viaXargs });
      break;
    case 'docker':
      if (args[0] === 'cp' && args.length >= 3) {
        const dest = args[args.length - 1];
        if (!/^[\w.-]+:/.test(dest)) target(dest);
      }
      break;
    default:
      if (INTERPRETERS.has(cmd)) interpreter(env, cmd, args, seg);
  }
}

// ---------------------------------------------------------------------------------------------
// core.hooksPath hors de git config (L19-02, décision de Julien du 21 nov. 2026). Comme
// `git -c core.hooksPath=`, sont refusés à toutes les sessions : la clé passée par l'environnement
// (GIT_CONFIG_PARAMETERS, que `-c` transmet aux sous-processus de git ; GIT_CONFIG_COUNT avec
// GIT_CONFIG_KEY_<n> et GIT_CONFIG_VALUE_<n>, git >= 2.31) ou par `--config-env`, et un fichier
// inclus depuis la ligne de commande ou l'environnement (`include.path`, `includeIf.*.path`), qui
// peut la fixer. Ces sources passent avant la configuration locale où husky pose core.hooksPath ;
// GIT_CONFIG_GLOBAL et GIT_CONFIG_SYSTEM passent après, ils restent permis. Une valeur illisible de
// ces variables, ou une clé `-c` illisible, est refusée.

/** Variables d'environnement par lesquelles git lit une configuration de ligne de commande. */
const GIT_CONFIG_ENV = /^GIT_CONFIG_(PARAMETERS|COUNT|KEY_\w*|VALUE_\w*)$/;
const INCLUDE_KEY = /^include(if)?\./i;

/** Refus d'une clé de configuration passée à git hors de git config (-c, --config-env, variable). */
function configKeyRefusal(key, what) {
  if (key.includes(UNKNOWN))
    return (
      `${what} : clé de configuration illisible ; elle peut fixer core.hooksPath, ce qui ` +
      'désactive le hook pre-commit : illisible, donc refusée — écris la clé en clair'
    );
  if (/^core\.hookspath$/i.test(key))
    return `${what} : changer core.hooksPath désactive le hook pre-commit`;
  if (INCLUDE_KEY.test(key))
    return (
      `${what} : un fichier inclus depuis la ligne de commande peut fixer core.hooksPath, ce qui ` +
      'désactive le hook pre-commit, sans que son contenu se vérifie : interdit'
    );
  return null;
}

/** Affectation d'une variable GIT_CONFIG_* (`known` : valeur lisible en entier). */
function gitConfigEnv(env, name, value, known) {
  if (!GIT_CONFIG_ENV.test(name)) return;
  if (!known || value.includes(UNKNOWN)) {
    env.deny(
      `variable ${name} illisible (${shown(value)}) : git en lit une configuration qui passe ` +
        'avant la configuration locale (core.hooksPath compris) ; illisible, donc refusée — ' +
        'écris la valeur en clair',
    );
    return;
  }
  const what = `variable ${name}`;
  let refusal = null;
  if (name.startsWith('GIT_CONFIG_KEY_')) refusal = configKeyRefusal(value, what);
  else if (name === 'GIT_CONFIG_PARAMETERS') {
    // Liste de 'clé=valeur' (ou 'clé'='valeur') entre apostrophes : une clé ne peut pas y être
    // coupée sans y insérer un caractère, la recherche dans le texte suffit.
    if (/core\.hookspath/i.test(value)) refusal = configKeyRefusal('core.hooksPath', what);
    else if (/(^|[\s'])include(if)?\./i.test(value)) refusal = configKeyRefusal('include.', what);
  }
  if (refusal !== null) env.deny(refusal);
}

// ---------------------------------------------------------------------------------------------
// Clés qui lancent une commande hors de -c (L25-01, L19-05, décision de Julien du 21 nov. 2026).
// GIT_CONFIG_PARAMETERS, GIT_CONFIG_COUNT avec GIT_CONFIG_KEY_<n> et GIT_CONFIG_VALUE_<n>, et
// `--config-env <clé>=<variable>` donnent à git les mêmes entrées que `-c <clé>=<valeur>` : chaque
// entrée lisible passe par configEntry, comme -c (commande analysée comme du code shell imbriqué,
// alias qui pousse refusé, transport ext:: refusé). Une valeur illisible d'une clé qui lance une
// commande est refusée : variable de --config-env absente de la commande ou calculée,
// GIT_CONFIG_KEY_<n> sans GIT_CONFIG_VALUE_<n> lisible, GIT_CONFIG_PARAMETERS que git rejette.
// Toutes les paires GIT_CONFIG_KEY_<n> sont lues, sans tenir compte de GIT_CONFIG_COUNT
// (surestimation prudente). Mesures (git 2.30.2 de l'hôte) : docs/comptes-rendus/lot-25-lead.md.

/** Blancs au sens de git (sane_ctype de git-compat-util.h : espace, \t, \n, \r). */
const GIT_BLANK = new Set([' ', '\t', '\n', '\r']);

/**
 * Pas de sq_dequote_step (quote.c de git) : texte entre apostrophes qui commence à `start`
 * (`'\''` et `'\!'` hors des apostrophes rendent l'apostrophe et le point d'exclamation). Rend
 * { text, next } (`next` : indice qui suit, null en fin de texte) ou null si git le rejette.
 */
function sqDequoteStep(s, start) {
  if (s[start] !== "'") return null;
  let text = '';
  let j = start;
  for (;;) {
    j += 1;
    if (j >= s.length) return null;
    if (s[j] !== "'") {
      text += s[j];
      continue;
    }
    j += 1;
    if (j >= s.length) return { text, next: null };
    if (s[j] === '\\' && (s[j + 1] === "'" || s[j + 1] === '!') && s[j + 2] === "'") {
      text += s[j + 1];
      j += 2;
      continue;
    }
    return { text, next: j };
  }
}

/**
 * Entrées de GIT_CONFIG_PARAMETERS lues comme git (parse_config_env_list de config.c, git >= 2.31,
 * qui lit aussi l'ancienne forme de git 2.30) : 'clé=valeur' (coupée au premier « = », blancs
 * autour de la clé retirés), 'clé'='valeur', 'clé'= ou 'clé' (booléen, valeur null), séparées par
 * des blancs. Rend la liste { key, value }, ou null pour un texte que git rejette.
 */
export function parseConfigParameters(text) {
  const entries = [];
  let cur = 0;
  while (cur !== null && cur < text.length) {
    const step = sqDequoteStep(text, cur);
    if (step === null) return null;
    cur = step.next;
    if (cur === null || GIT_BLANK.has(text[cur])) {
      const at = step.text.indexOf('=');
      const key = (at < 0 ? step.text : step.text.slice(0, at)).trim();
      if (key === '') return null;
      entries.push({ key, value: at < 0 ? null : step.text.slice(at + 1) });
    } else if (text[cur] === '=') {
      cur += 1;
      if (text[cur] === "'") {
        const value = sqDequoteStep(text, cur);
        if (value === null || (value.next !== null && !GIT_BLANK.has(text[value.next])))
          return null;
        entries.push({ key: step.text, value: value.text });
        cur = value.next;
      } else if (cur >= text.length || GIT_BLANK.has(text[cur])) {
        entries.push({ key: step.text, value: null });
      } else return null;
    } else return null;
    while (cur !== null && GIT_BLANK.has(text[cur])) cur += 1;
  }
  return entries;
}

/** protocol.allow, protocol.ext.allow : autre que never, ils permettent le transport ext::. */
const PROTOCOL_KEY = /^protocol\.(ext\.)?allow$/i;
const EXT_MOTIF =
  'le transport ext:: lance la commande écrite dans l’URL du dépôt, sans qu’elle se vérifie : ' +
  'interdit (seul protocol.ext.allow=never est permis)';

/** Clé dont la valeur doit se lire : commande lancée par git, alias, transport ext::. */
function valueMatters(key) {
  const k = key.trim();
  return COMMAND_CONFIG_KEY.test(k) || PROTOCOL_KEY.test(k) || /^alias\./i.test(k);
}

/**
 * Entrée de configuration donnée à git hors des fichiers (-c, --config-env, GIT_CONFIG_*) : clé lue
 * comme git (blancs autour retirés, casse ignorée), `value` null pour un booléen sans valeur.
 * Mêmes refus que -c : core.hooksPath et inclusion (L19-02), alias qui pousse, transport ext::,
 * commande lancée par git analysée comme du code shell imbriqué. Un alias est analysé dès sa
 * définition (`!code` comme du code shell, sinon comme `git <valeur>`) : un git lancé plus loin
 * (sous-processus, programme) peut l'utiliser sans qu'on le voie.
 */
function configEntry(env, rawKey, value, what, base) {
  const key = rawKey.trim();
  const refusal = configKeyRefusal(key, what);
  if (refusal !== null) {
    env.deny(refusal);
    return;
  }
  if (value === null) return;
  if (PROTOCOL_KEY.test(key)) {
    if (value.trim().toLowerCase() !== 'never') env.deny(`${what} : ${EXT_MOTIF}`);
    return;
  }
  if (/^alias\./i.test(key)) {
    if (/\bpush\b/.test(value)) {
      env.deny(
        `un alias qui lance git push (${shown(`${key}=${value}`)}) contourne la règle de push`,
      );
      return;
    }
    env.nested(`${what}`, value.startsWith('!') ? value.slice(1) : `git ${value}`, base);
    return;
  }
  if (COMMAND_CONFIG_KEY.test(key)) env.nested(what, value.replace(/^!/, ''), base);
}

/** Variables du shell complétées par celles d'une commande (`NOM=valeur cmd`). */
function overlayVars(vars, assignments) {
  const out = new Map(vars);
  for (const a of assignments) {
    const k = a.indexOf('=');
    const value = a.slice(k + 1);
    out.set(
      a.slice(0, k).replace(/\[.*$|\+$/, ''),
      value.includes(UNKNOWN) || a[k - 1] === '+' ? null : value,
    );
  }
  return out;
}

/**
 * Entrées de configuration que git lit dans l'environnement `vars` (nom → valeur, null : absente
 * ou illisible, déjà refusée par gitConfigEnv) : { entries, pending, bogus } ; `pending` : clés
 * GIT_CONFIG_KEY_<n> sans GIT_CONFIG_VALUE_<n> ; `bogus` : GIT_CONFIG_PARAMETERS que git rejette.
 */
function envConfigEntries(vars) {
  const entries = [];
  const pending = [];
  let bogus = null;
  const params = vars.get('GIT_CONFIG_PARAMETERS');
  if (typeof params === 'string' && !params.includes(UNKNOWN)) {
    const parsed = parseConfigParameters(params);
    if (parsed === null) bogus = params;
    else for (const e of parsed) entries.push({ ...e, from: 'GIT_CONFIG_PARAMETERS' });
  }
  for (const [name, key] of vars) {
    const m = /^GIT_CONFIG_KEY_(.*)$/.exec(name);
    if (m === null || typeof key !== 'string' || key.includes(UNKNOWN)) continue;
    const value = vars.get(`GIT_CONFIG_VALUE_${m[1]}`);
    if (typeof value !== 'string') pending.push({ key, from: name, index: m[1] });
    else if (!value.includes(UNKNOWN)) entries.push({ key, value, from: name });
  }
  return { entries, pending, bogus };
}

/**
 * Analyse les entrées de configuration de l'environnement `vars` (une fois chacune) ; `final` : la
 * commande ne donnera plus de valeur (fin de commande ou de sous-shell, variables d'une commande).
 */
function checkEnvConfig(env, vars, final) {
  const { entries, pending, bogus } = envConfigEntries(vars);
  if (bogus !== null)
    env.deny(
      `variable GIT_CONFIG_PARAMETERS (${shown(bogus)}) : format que git rejette ('clé=valeur' ou ` +
        "'clé'='valeur' entre apostrophes, séparés par des blancs) ; lu autrement, il pourrait " +
        'cacher une entrée : illisible, donc refusée',
    );
  for (const { key, value, from } of entries) {
    const id = `${from}\0${key}\0${value}`;
    if (env.st.configSeen.has(id)) continue;
    env.st.configSeen.add(id);
    configEntry(env, key, value, `variable ${from} (${shown(key.trim())})`, env.st.base);
  }
  if (!final) return;
  for (const { key, from, index } of pending) {
    if (valueMatters(key))
      env.deny(
        `variable ${from}=${shown(key)} sans GIT_CONFIG_VALUE_${index} lisible dans la commande : ` +
          "la valeur, une commande que git lancerait, viendrait de l'environnement ; illisible, " +
          'donc refusée',
      );
  }
}

/** GIT_ALLOW_PROTOCOL (liste séparée par « : ») qui permet ext::, ou illisible. */
function allowProtocolEnv(env, name, value, known) {
  if (name !== 'GIT_ALLOW_PROTOCOL') return;
  if (!known || value.includes(UNKNOWN))
    env.deny(
      `variable GIT_ALLOW_PROTOCOL illisible (${shown(value)}) : elle peut permettre le transport ` +
        'ext:: ; illisible, donc refusée',
    );
  else if (value.split(':').some((p) => p.trim().toLowerCase() === 'ext'))
    env.deny(`variable GIT_ALLOW_PROTOCOL=${shown(value)} : ${EXT_MOTIF}`);
}

function assignVar(env, a) {
  const { st, deny, nested } = env;
  const k = a.indexOf('=');
  const lhs = a.slice(0, k);
  const name = lhs.replace(/\[.*$|\+$/, '');
  const value = a.slice(k + 1);
  const known = !value.includes(UNKNOWN) && !lhs.endsWith('+') && !lhs.includes('[');
  st.vars.set(name, known ? value : null);
  if (name === 'HUSKY' && (!known || value === '0'))
    deny(`désactiver husky (${shown(a)}) est interdit`);
  if (/^GIT_/.test(name)) st.gitEnv.push(a);
  gitConfigEnv(env, name, value, known);
  allowProtocolEnv(env, name, value, known);
  // L25-01 : la valeur d'une clé peut venir plus loin dans la commande (vérifiée à la fin).
  if (GIT_CONFIG_ENV.test(name)) checkEnvConfig(env, st.vars, false);
  if (CODE_FILE_ENV.has(name))
    deny(`variable ${name} : elle fait charger un code au démarrage ; illisible, donc refusée`);
  if (COMMAND_ENV.has(name) && value !== '') nested(`variable ${name}`, value);
}

/** Interpréteur : code en ligne, script ou code lu sur l'entrée standard. */
function interpreter(env, cmd, args, seg) {
  const { deny, nested, opaque } = env;
  if (cmd === 'source' || cmd === '.') {
    if (args[0]) runScript(env, cmd, args[0], seg);
    return;
  }
  if (SHELLS.has(cmd)) {
    // Code en ligne d'un shell : l'opérande qui suit l'option -c (seule ou groupée, -lc, -ec…).
    const at = args.findIndex((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a));
    if (at >= 0) {
      const code = args[at + 1] ?? '';
      if (args.slice(at + 2).some((a) => a.includes(UNKNOWN)) && /\$/.test(code))
        deny(`arguments calculés passés au code de ${cmd} -c : illisible, donc refusé`);
      nested(`${cmd} -c`, code);
      return;
    }
  } else if (
    args.some((a) => INLINE_FLAGS.has(a) || /^-[a-zA-Z]*[ce]$/.test(a) || a.startsWith('--eval='))
  ) {
    if (args.some((a) => a.includes(UNKNOWN)))
      deny(`code en ligne calculé (${cmd}) : illisible, donc refusé`);
    opaque(cmd, `${args.join(' ')}\n${seg.heredoc}`);
    return;
  }
  const ops = operands(args, INTERPRETER_VALUED);
  if (cmd === 'deno' || cmd === 'bun') {
    // Sous-commandes (install, add, x…) : seul un chemin de script se lit.
    if (['run', 'test'].includes(ops[0])) ops.shift();
    if (ops[0] !== undefined && !/[/.]/.test(ops[0])) return;
  }
  if (ops.length > 0 && ops[0] !== '-') {
    runScript(env, cmd, ops[0], seg);
    if (args.includes('--test')) ops.slice(1).forEach((p) => runScript(env, cmd, p, seg));
    return;
  }
  stdinCode(env, cmd, args, seg);
}

/** Script exécuté : il doit être lisible avant l'exécution (ni calculé, ni écrit par la commande). */
function runScript(env, cmd, path, seg) {
  const { st, deny, opaque, result, readable } = env;
  const abs = readable(path, `script de ${cmd}`);
  if (abs === null) return;
  const files = scriptFiles(abs);
  if (files === null) {
    deny(`script de ${cmd} illisible (${path}) : motif sans fichier ou motif de dossier`);
    return;
  }
  if (files.some((f) => st.written.has(f))) {
    deny(
      `script ${path} écrit par la même commande : son contenu n'est pas lisible avant exécution ; ` +
        'illisible, donc refusé',
    );
    return;
  }
  const texts = files.map(readSmallFile);
  if (texts.some((t) => t === null)) {
    deny(`script de ${cmd} illisible (${path}) : absent, pas un fichier ou plus de 512 Ko`);
    return;
  }
  result.scripts.push({ path, base: st.base ?? env.cwd });
  opaque(cmd, `${texts.join('\n')}\n${seg.heredoc}`, st.base, path);
}

/** Code lu sur l'entrée standard : here-document, here-string ou fichier redirigé, sinon refusé. */
function stdinCode(env, cmd, args, seg) {
  const { st, deny, nested, opaque, readable } = env;
  if (args.includes('-m') || args.some((a) => INFO_FLAGS.has(a))) return;
  let text = seg.heredoc;
  for (const input of seg.inputs) {
    const abs = readable(resolveWord(input, st), `entrée de ${cmd}`);
    if (abs === null) return;
    const content = readSmallFile(abs);
    if (content === null && !DEV_FILES.has(abs)) {
      deny(`entrée de ${cmd} illisible (${wordText(input)})`);
      return;
    }
    text += content ?? '';
  }
  if (seg.dynamicInput) {
    deny(
      `code de ${cmd} calculé (here-document ou here-string avec expansions) : illisible, donc refusé`,
    );
    return;
  }
  if (text === '') {
    if (seg.pipedIn)
      deny(
        `${cmd} lit son code sur un tube : illisible, donc refusé ; passe le code en ligne, par un ` +
          'fichier ou par un here-document',
      );
    return;
  }
  if (SHELLS.has(cmd)) nested(`${cmd} (entrée standard)`, text);
  else opaque(cmd, text);
}

// ---------------------------------------------------------------------------------------------
// git

const GIT_GLOBAL_VALUED = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
  '--config-env',
  '--attr-source',
]);

/** Sous-commandes de git (porcelaine, plomberie, aides) : le reste est un alias ou un programme externe. */
const GIT_COMMANDS = new Set(
  (
    'add am annotate apply archimport archive backfill bisect blame branch bugreport bundle cat-file ' +
    'check-attr check-ignore check-mailmap check-ref-format checkout checkout-index cherry ' +
    'cherry-pick citool clean clone column commit commit-graph commit-tree config count-objects ' +
    'credential credential-cache credential-store cvsexportcommit cvsimport cvsserver daemon ' +
    'describe diagnose diff diff-files diff-index diff-pairs diff-tree difftool fast-export ' +
    'fast-import fetch fetch-pack filter-branch filter-repo fmt-merge-msg for-each-ref for-each-repo ' +
    'format-patch fsck fsck-objects fsmonitor--daemon gc get-tar-commit-id grep gui hash-object ' +
    'help hook http-backend http-fetch http-push imap-send index-pack init init-db instaweb ' +
    'interpret-trailers last-modified log ls-files ls-remote ls-tree mailinfo mailsplit ' +
    'maintenance merge merge-base merge-file merge-index merge-one-file merge-tree mergetool mktag ' +
    'mktree multi-pack-index mv name-rev notes p4 pack-objects pack-redundant pack-refs patch-id ' +
    'prune prune-packed pull push quiltimport range-diff read-tree rebase receive-pack reflog refs ' +
    'remote repack replace replay repo request-pull rerere reset restore rev-list rev-parse revert ' +
    'rm send-email send-pack sh-i18n sh-setup shell shortlog show show-branch show-index show-ref ' +
    'sparse-checkout stage stash status stripspace submodule svn switch symbolic-ref tag ' +
    'unpack-file unpack-objects update-index update-ref update-server-info upload-archive ' +
    'upload-pack var verify-commit verify-pack verify-tag version whatchanged worktree write-tree'
  ).split(' '),
);

// git push (git flow, décision de Julien du 19 nov. 2026 ; flux par pull request, L20-01, décision du
// 21 nov. 2026). Seules formes permises, et seulement à la session principale (rôle « main », sans
// agent_type) :
//   git [-C <chemin>] [-c <clé>=<valeur>] push [-u | --set-upstream] origin develop[:develop]
//   git [-C <chemin>] [-c <clé>=<valeur>] push [-u | --set-upstream] origin lot/<nom>[:lot/<nom>]
//   git [-C <chemin>] [-c <clé>=<valeur>] push [-u | --set-upstream] origin release/<x.y.z>[:release/<x.y.z>]
// develop reste permise pour l'instant (fusion du lot 20) ; la protection de develop sur GitHub la
// refuse ensuite. release/<majeur>.<mineur>.<correctif> (L22-02, décision de Julien du 21 nov. 2026)
// porte la pull request vers main, ouverte et fusionnée par la session principale après l'accord
// explicite de Julien (règle de l'orchestrateur, que le hook ne peut pas vérifier). Tout le reste
// est refusé avec son motif : rôle d'agent, autre remote, autre branche ou refspec (main, HEAD, +…,
// :…, lot/<a>:lot/<b>, release/<a>:release/<b>, étiquette), push forcé, suppression, plusieurs
// références, options transmises au serveur, refspec absente (git push nu dépend de la
// configuration). Pousser main, créer ou pousser une étiquette et déployer sont réservés à Julien.
const PUSH_REMOTE = 'origin';
const PUSH_BRANCH = 'develop';
const PUSH_REFSPECS = new Set([PUSH_BRANCH, `${PUSH_BRANCH}:${PUSH_BRANCH}`]);
/** Refspec d'une branche poussée sous son nom (`<nom>` ou `<nom>:<nom>`), nom conforme à `re`. */
function sameNameRefspec(spec, re) {
  const [src, dst, ...more] = spec.split(':');
  return more.length === 0 && re.test(src) && (dst === undefined || dst === src);
}
/** Refspec d'une branche de lot poussée sous son nom : lot/<nom> ou lot/<nom>:lot/<nom>. */
const lotRefspec = (spec) => sameNameRefspec(spec, LOT_BRANCH);
/** Refspec d'une branche de release poussée sous son nom (L22-02). */
const releaseRefspec = (spec) => sameNameRefspec(spec, RELEASE_BRANCH);
const PUSH_UPSTREAM = new Set(['-u', '--set-upstream']);
/** Options globales de git qui changent le dépôt, l'espace de noms ou la configuration du push. */
const PUSH_GLOBAL_DENIED = new Set([
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--config-env',
  '--exec-path',
]);
/** Seules options globales admises avec git push. */
const PUSH_GLOBAL_ALLOWED = new Set(['-C', '-c', '--no-pager', '-P']);
/** Clés de configuration (-c) qui changent la destination, les références ou la commande poussées. */
const PUSH_CONFIG_KEYS = /^(remote|url|push|branch|alias)\./i;
/** Clés -c admises avec git push : sans effet sur la destination ni sur la connexion. */
const PUSH_CONFIG_ALLOWED = /^((color|advice|user|i18n)\.[^=]+|core\.quotepath)=/i;
const PUSH_FORM = `seules les formes git push origin ${PUSH_BRANCH}, git push origin lot/<nom> et git push origin release/<majeur>.<mineur>.<correctif> (avec -u ou --set-upstream au besoin) sont permises`;

/** Clés dont l'écriture redéfinit la destination d'un push (T3 du lot 13 bis). */
// L18-02 : branch.autoSetupMerge et branch.autoSetupRebase règlent le suivi des branches créées.
const DESTINATION_KEY =
  /^(remote\..+|url\..+|push\..+|branch\..+\.(remote|pushremote)|branch\.autosetup(merge|rebase)|include\..+|includeif\..+)$/i;
const DESTINATION_SECTION = /^(remote|url|push|branch|include|includeif)(\.|$)/i;
/**
 * Clés dont la valeur est une commande lancée par git. L25-01 : en plus, la commande qui remplace
 * git-upload-pack ou git-receive-pack d'un remote (lancée en local pour un dépôt local),
 * core.alternateRefsCommand, gpg.ssh.defaultKeyCommand, les commandes de trailer, de sendemail,
 * d'imap-send (tunnel), de guitool, de navigateur, de man et la mise à jour `!commande` d'un
 * sous-module.
 */
const COMMAND_CONFIG_KEY =
  /^(core\.(editor|pager|sshcommand|askpass|fsmonitor|gitproxy|alternaterefscommand)|sequence\.editor|diff\.external|gpg\.(.+\.)?program|gpg\.ssh\.defaultkeycommand|credential\.(.+\.)?helper|pager\..+|interactive\.difffilter|uploadpack\.packobjectshook|(diff|merge|filter|mergetool|difftool)\..+\.(command|cmd|textconv|clean|smudge|process|driver|path)|remote\..+\.(uploadpack|receivepack)|trailer\..+\.(command|cmd)|sendemail\.(.+\.)?(smtpserver|tocmd|cccmd|sendmailcmd)|imap\.tunnel|guitool\..+\.cmd|browser\..+\.(cmd|path)|man\..+\.(cmd|path)|instaweb\.httpd|submodule\..+\.update)$/i;
const DESTINATION_MOTIF =
  'redéfinit la destination des push (remote, url, push, branche suivie, inclusion) : réservé à Julien';

function pushOptionRefusal(a) {
  if (a.startsWith('--force') || /^-[a-zA-Z]*f/.test(a))
    return `push forcé (${a}) interdit à tous : il réécrit l'historique distant`;
  if (a === '--delete' || /^-[a-zA-Z]*d/.test(a))
    return `suppression d'une branche distante (${a}) réservée à Julien`;
  if (a === '--prune') return `${a} supprime des branches distantes : réservé à Julien`;
  if (['--all', '--branches', '--mirror'].includes(a))
    return `${a} pousse plusieurs références : ${PUSH_FORM}`;
  if (a === '--tags' || a === '--follow-tags')
    return `${a} pousse des étiquettes : les étiquettes de version sont réservées à Julien`;
  if (a.startsWith('--push-option') || /^-[a-zA-Z]*o/.test(a))
    return `options transmises au serveur (${a}) interdites : ${PUSH_FORM}`;
  if (a === '--no-verify') return `${a} contourne le hook pre-push : interdit`;
  if (['--repo', '--receive-pack', '--exec'].some((o) => a === o || a.startsWith(`${o}=`)))
    return `${a} change le dépôt ou la commande distante : ${PUSH_FORM}`;
  return `option ${a} non permise : ${PUSH_FORM}`;
}

function refspecRefusal(spec) {
  if (spec.startsWith('+')) return `refspec forcée (${spec}) interdite à tous`;
  if (spec === '' || spec.startsWith(':'))
    return `refspec « ${spec} » : supprime une branche distante, réservé à Julien`;
  const refs = spec.split(':');
  if (refs.some((r) => /^(refs\/heads\/)?(main|master)$/.test(r)))
    return (
      `${spec} : main est réservée à Julien pour le push (correctif urgent) ; la session ` +
      'principale y fusionne par une pull request release/<version>, après son accord explicite'
    );
  if (refs.some((r) => r.startsWith('refs/tags/')))
    return `${spec} : les étiquettes de version sont réservées à Julien`;
  if (refs.some((r) => /^HEAD\b/.test(r) || r === '@'))
    return `${spec} : HEAD dépend de la branche courante ; ${PUSH_FORM}`;
  if (refs.some((r) => /^(refs\/heads\/)?lot\//.test(r)))
    return `${spec} : une branche de lot se pousse sous son nom, en clair (git push -u origin lot/<nom>)`;
  if (refs.some((r) => /^(refs\/heads\/)?release\//.test(r)))
    return (
      `${spec} : une branche de release se pousse sous son nom, en clair ` +
      '(git push -u origin release/<majeur>.<mineur>.<correctif>)'
    );
  return `refspec ${spec} refusée : ${PUSH_FORM}`;
}

/** Destinations permises d'un push de la session principale (messages). */
const PUSH_TARGETS = `${PUSH_BRANCH}, les branches lot/* et release/<version> vers ${PUSH_REMOTE}`;

/** Motif du refus d'un git push, ou null s'il est permis. `globals` : options globales de git. */
function pushRefusal(rest, { role, globals, assignments, dashed }) {
  if (dashed)
    return (
      `git-push appelé directement : écris git push ; seule la session principale pousse, et ` +
      `uniquement ${PUSH_TARGETS}`
    );
  if (role !== 'main') {
    return (
      `git push est interdit aux agents (rôle ${role ?? 'inconnu'}) : seule la session principale ` +
      `pousse, et uniquement ${PUSH_TARGETS}`
    );
  }
  for (const [opt, value] of globals) {
    const name = opt.split('=')[0];
    if (PUSH_GLOBAL_DENIED.has(name))
      return `option globale ${opt} : elle change le dépôt ou la configuration du push ; ${PUSH_FORM}`;
    if (!PUSH_GLOBAL_ALLOWED.has(name))
      return `option globale ${opt} non permise avec git push (seules -C, -c, --no-pager et -P) ; ${PUSH_FORM}`;
    if (opt === '-c' && PUSH_CONFIG_KEYS.test(value))
      return `git -c ${value} : cette configuration change ce que pousse git push ; ${PUSH_FORM}`;
    if (opt === '-c' && !PUSH_CONFIG_ALLOWED.test(value))
      return (
        `git -c ${shown(value)} : seules les clés color.*, advice.*, user.*, i18n.* et ` +
        `core.quotepath sont des clés admises avec git push ; ${PUSH_FORM}`
      );
  }
  const env = assignments.find((a) => /^GIT_/.test(a));
  if (env)
    return `variable ${env.split('=')[0]} : elle change le dépôt ou la configuration du push`;
  const ops = [];
  for (const a of rest) {
    // « -- » compris : la forme permise n'en a pas besoin, toute autre option est refusée.
    if (a.startsWith('-') && !PUSH_UPSTREAM.has(a)) return pushOptionRefusal(a);
    if (!a.startsWith('-')) ops.push(a);
  }
  if (ops.length < 2) {
    return (
      `git push sans ${ops.length === 0 ? 'remote ni ' : ''}branche explicite dépend de la configuration ` +
      `(push.default, branche suivie) : ${PUSH_FORM}`
    );
  }
  const [remote, ...specs] = ops;
  if (specs[0] === 'tag')
    return 'git push … tag : les étiquettes de version sont réservées à Julien';
  if (specs.length > 1) return `plusieurs refspecs (${specs.map(shown).join(' ')}) : ${PUSH_FORM}`;
  if (remote !== PUSH_REMOTE)
    return `remote ${shown(remote)} refusé : seul ${PUSH_REMOTE} est permis`;
  if (!PUSH_REFSPECS.has(specs[0]) && !lotRefspec(specs[0]) && !releaseRefspec(specs[0]))
    return refspecRefusal(shown(specs[0]));
  return null;
}

/**
 * Options dont la valeur est la commande lancée à la place de git-upload-pack (ou de
 * git-upload-archive) : en local pour un dépôt local, sur l'hôte distant sinon (L25-01).
 */
const LAUNCHER_OPTIONS = {
  fetch: { long: ['--upload-pack'] },
  pull: { long: ['--upload-pack'] },
  'ls-remote': { long: ['--upload-pack'] },
  clone: { long: ['--upload-pack'], short: 'u' },
  'fetch-pack': { long: ['--upload-pack', '--exec'] },
  archive: { long: ['--exec'] },
};

/**
 * Valeurs des options longues `long` (abréviations comprises, comme parse-options de git : `--upl`,
 * `--u` ; `=valeur` ou mot suivant) et de l'option courte `short` (seule, collée `-uX` ou en
 * groupe `-qu X`), avant `--`.
 */
function launcherValues(args, long, short) {
  const out = [];
  for (let k = 0; k < args.length; k += 1) {
    const a = args[k];
    if (a === '--') break;
    if (a.startsWith('--')) {
      const name = a.split('=')[0];
      if (!long.some((l) => name.length >= 3 && l.startsWith(name))) continue;
      if (a.includes('=')) out.push(a.slice(a.indexOf('=') + 1));
      else if (k + 1 < args.length) out.push(args[(k += 1)]);
    } else if (short && /^-[^-]/.test(a) && a.indexOf(short, 1) > 0) {
      const glued = a.slice(a.indexOf(short, 1) + 1);
      if (glued !== '') out.push(glued);
      else if (k + 1 < args.length) out.push(args[(k += 1)]);
    }
  }
  return out;
}

/**
 * Valeurs possibles d'un alias git : entrées de l'environnement (GIT_CONFIG_*), de la commande
 * (-c, --config-env), puis configuration vue depuis `base`. git lance la dernière définie (la
 * commande l'emporte sur l'environnement, qui l'emporte sur les fichiers) ; toutes sont rendues,
 * pour être toutes analysées (L25-01 : avant, le premier -c l'emportait, et le dépôt sur
 * l'environnement).
 */
function gitAliases(base, sub, entries) {
  const name = `alias.${sub}`.toLowerCase();
  const values = entries
    .filter((e) => e.key.trim().toLowerCase() === name && typeof e.value === 'string')
    .map((e) => e.value);
  if (base !== null) {
    try {
      values.push(
        execFileSync('git', ['-C', base, 'config', '--get', `alias.${sub}`], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 5000,
        }).replace(/\n$/, ''),
      );
    } catch {
      // Pas d'alias de ce nom dans la configuration du dépôt.
    }
  }
  return [...new Set(values)];
}

/** Options de git config suivies d'une valeur (mot séparé) : cette valeur n'est pas une option. */
const CONFIG_VALUED = new Set([
  '-f',
  '--file',
  '--blob',
  '--type',
  '-t',
  '--default',
  '--comment',
  '--value',
]);
/** Actions de lecture de l'ancienne syntaxe (mot exact). */
const CONFIG_READS = new Set([
  '--get',
  '--get-all',
  '--get-regexp',
  '--get-urlmatch',
  '--get-color',
  '--get-colorbool',
  '-l',
  '--list',
]);
/** Actions d'écriture de l'ancienne syntaxe ; git accepte un préfixe sans ambiguïté (--unset-a). */
const CONFIG_WRITES = [
  '--add',
  '--replace-all',
  '--unset',
  '--unset-all',
  '--rename-section',
  '--remove-section',
  '--edit',
];

/**
 * Écriture git config : clés et sections touchées, ou édition libre ; null pour une lecture
 * (L18-01). Les options sont lues à leur place : la valeur d'une option (--comment --get) n'est
 * pas prise pour une action. Une lecture se reconnaît à son action écrite en entier (--get…,
 * --list, sous-commandes get et list) ou à l'absence de valeur (git config <clé>) ; un mot qui
 * peut abréger une action d'écriture (--unset-a, --un) compte comme écriture.
 */
function gitConfigWrite(rest) {
  const flags = [];
  const ops = [];
  for (let j = 0; j < rest.length; j += 1) {
    const a = rest[j];
    if (a === '--') {
      ops.push(...rest.slice(j + 1));
      break;
    }
    if (CONFIG_VALUED.has(a)) j += 1;
    else if (a.startsWith('-') && a !== '-') flags.push(a.split('=')[0]);
    else ops.push(a);
  }
  const writes = (...names) =>
    flags.some((f) =>
      names.some((n) => f === n || (f.startsWith('--') && f.length > 2 && n.startsWith(f))),
    );
  const written =
    flags.includes('-e') ||
    flags.some((f) => f.length > 2 && CONFIG_WRITES.some((n) => n.startsWith(f)));
  if (!written && (flags.some((f) => CONFIG_READS.has(f)) || ['get', 'list'].includes(ops[0])))
    return null;
  if (flags.includes('-e') || writes('--edit') || ops[0] === 'edit')
    return { edit: true, keys: [], sections: [], values: [] };
  if (['set', 'unset'].includes(ops[0]))
    return { keys: [ops[1] ?? ''], values: ops.slice(2), sections: [] };
  if (['rename-section', 'remove-section'].includes(ops[0]))
    return { keys: [], values: [], sections: ops.slice(1) };
  if (writes('--rename-section', '--remove-section'))
    return { keys: [ops[0] ?? ''], values: [], sections: ops };
  if (writes('--unset', '--unset-all')) return { keys: [ops[0] ?? ''], values: [], sections: [] };
  if (ops.length >= 2 || written)
    return { keys: [ops[0] ?? ''], values: ops.slice(1), sections: [] };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Branche locale main (L14-06, décision de Julien du 19 nov. 2026) : aucune session, la principale
// comprise, n'écrit la branche locale main, qui partirait dans le prochain push de Julien. Refusés :
// merge, pull, rebase, cherry-pick, revert, am et reset qui déplace la branche quand la branche
// courante est main ; création, déplacement, renommage, copie vers main ou suppression de main
// (branch, checkout -b/-B/--orphan/--track, switch -c/-C/--orphan/--track, worktree add -b/-B,
// update-ref, symbolic-ref, fetch ou pull vers main). Restent permis par la même décision :
// l'étiquette locale (git tag) et le déplacement local de develop (branch -f, update-ref,
// checkout -B). Le commit sur main et ses équivalents (décision de Julien du 20 nov. 2026) :
// commit (sauf --dry-run), citool, gui, quiltimport, svn rebase, p4 rebase ; et les autres
// écritures de références : stash branch, fast-import (références du flux lu), replay (sauf
// --ref-action=print), rebase --update-refs (branches du parcours, illisibles).
// La branche courante est lue dans le dépôt (git symbolic-ref) ou suivie dans la commande quand
// elle y change (checkout, switch, worktree add, symbolic-ref, rebase <branche>) ; si elle est
// illisible (dossier ou dépôt calculé, branche calculée, checkout -), l'écriture est refusée.

const MAIN_REF = /^(refs\/heads\/|heads\/)?main$/;
const MAIN_MOTIF =
  'la branche locale main ne s’écrit pas, par aucune session (décision de Julien du 19 nov. 2026) : ' +
  'elle partirait dans son prochain push ; seul Julien met à jour main';
const FETCH_VALUED = new Set([
  '--depth',
  '--deepen',
  '--shallow-since',
  '--shallow-exclude',
  '-j',
  '--jobs',
  '--upload-pack',
  '--refmap',
  '-o',
  '--server-option',
  '--negotiation-tip',
  '--filter',
  '-s',
  '--strategy',
  '-X',
  '--strategy-option',
]);
const GIT_EXEC_OPTIONS = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 };

/** Racine du dépôt qui contient `base`, ou `base` lui-même s'il n'est pas (encore) un dépôt. */
function repoKey(base) {
  try {
    return resolve(
      execFileSync('git', ['-C', base, 'rev-parse', '--show-toplevel'], GIT_EXEC_OPTIONS).trim(),
    );
  } catch {
    return resolve(base);
  }
}

/** Branche courante vue de `base` : nom, '' (HEAD détachée, pas de dépôt) ou texte illisible. */
function currentBranch(st, base) {
  if (base === null) return UNKNOWN;
  const key = repoKey(base);
  let best = null;
  for (const k of st.heads.keys()) {
    if ((key === k || key.startsWith(`${k}/`)) && (best === null || k.length > best.length))
      best = k;
  }
  if (best !== null) return st.heads.get(best);
  if (!existsSync(base)) return UNKNOWN;
  try {
    return execFileSync('git', ['-C', base, 'symbolic-ref', '-q', 'HEAD'], GIT_EXEC_OPTIONS)
      .trim()
      .replace(/^refs\/heads\//, '');
  } catch {
    return '';
  }
}

/** Retient la branche courante d'un dépôt changée par la commande. */
function setBranch(st, base, branch) {
  if (base !== null) st.heads.set(repoKey(base), branch);
}

/**
 * Nom de branche locale créée à partir d'une branche distante (checkout ou switch --track) : comme
 * git, retire `refs/`, puis `remotes/`, puis le nom du remote (`-t remotes/origin/main` crée main).
 */
function trackedName(ref) {
  return ref
    .replace(/^refs\//, '')
    .replace(/^remotes\//, '')
    .replace(/^[^/]*\//, '');
}

// ---------------------------------------------------------------------------------------------
// Branche suivie (L14-17 et L18-02, décisions de Julien du 20 nov. 2026) : git écrit
// branch.<branche>.remote et branch.<branche>.merge hors de la règle des destinations de push
// (git config branch.*.remote, refusé à tous). Refusés aux agents spécialisés, la session
// principale les garde :
// - git branch -u et --set-upstream-to (L14-17), git fetch et git pull --set-upstream ;
// - --track explicite (-t, --track=direct|inherit, abréviations, groupes d'options courtes) de
//   git branch, checkout, switch et worktree add, quel que soit le point de départ ;
// - la création d'une branche quand le suivi automatique s'applique : branch.autoSetupMerge, lu
//   dans -c puis dans la configuration vue du dépôt (true, le défaut : point de départ distant ;
//   always : toute branche ; inherit : branche qui a déjà un amont ; simple : distante de même nom ;
//   valeur inconnue ou configuration illisible : refusé) ; git branch <nom> <départ>, -f compris,
//   checkout -b|-B, switch -c|-C, worktree add -b|-B, sans point de départ = HEAD ;
// - la branche distante devinée : checkout <nom> et switch <nom> sans --no-guess, worktree add
//   <dossier> <nom>, et worktree add <dossier> avec --guess-remote ou worktree.guessRemote, quand le
//   nom n'est pas une révision locale et qu'une branche distante le porte ;
// - la copie d'une branche suivie (git branch -c|-C : git copie sa configuration).
// --no-track l'emporte quand il est le dernier des deux, comme pour git, et reste permis. Écrire
// branch.autoSetupMerge ou branch.autoSetupRebase est une écriture de destination (DESTINATION_KEY).

/** Options longues de git branch qui écrivent une branche nommée, [nom, abréviation minimale]. */
const BRANCH_WRITE_OPTIONS = [
  ['--delete', 4],
  ['--move', 4],
  ['--copy', 5],
];

const TRACK_MOTIF =
  'créer une branche qui suit une autre branche écrit branch.<branche>.remote, hors de la règle ' +
  'des destinations de push : interdit aux agents';

/** Sortie d'une lecture git depuis `base` (sans fin de ligne), ou null si git échoue. */
function gitOutput(base, args) {
  try {
    return execFileSync('git', ['-C', base, ...args], GIT_EXEC_OPTIONS).replace(/\n$/, '');
  } catch {
    return null;
  }
}

/** `word` écrit l'option longue `full` en entier ou en abrégé (au moins `min` caractères). */
function abbreviates(word, full, min) {
  const name = word.split('=')[0];
  return name === full || (name.length >= min && full.startsWith(name));
}

/**
 * Mode de suivi écrit dans les options : 'track' (--track, -t, abréviation, groupe d'options
 * courtes), 'never' (--no-track) ou null ; le dernier des deux l'emporte. Les valeurs des options
 * de `valued` et ce qui suit une lettre de `shortValued` dans un groupe ne sont pas des options.
 */
function trackOption(words, valued, shortValued) {
  let mode = null;
  for (let j = 0; j < words.length; j += 1) {
    const a = words[j];
    if (a === '--') break;
    if (valued.includes(a)) j += 1;
    else if (abbreviates(a, '--track', 3)) mode = 'track';
    else if (abbreviates(a, '--no-track', 6)) mode = 'never';
    else if (/^-[a-zA-Z0-9]+$/.test(a)) {
      for (const c of a.slice(1)) {
        if (c === 't') mode = 'track';
        if (c === 't' || shortValued.includes(c)) break;
      }
    }
  }
  return mode;
}

/**
 * Branches créées et opérandes d'une commande qui crée une branche (checkout, switch, worktree
 * add) : `create` (options longues [nom, abréviation minimale]) et `shortCreate` (lettres) prennent
 * le nom créé, collé ou en mot suivant ; les valeurs de `valued` sont sautées ; s'arrête à « -- ».
 * Dans un groupe d'options courtes, la lettre de création prend la suite du mot comme valeur, quels
 * qu'en soient les caractères (`-qblot/x`, L19-01). Une option dont le nom est calculé (`-$X`,
 * `--$X`) peut créer une branche : son nom compte comme illisible (UNKNOWN).
 */
function creationWords(words, { create = [], shortCreate = [], valued = [] }) {
  const created = [];
  const ops = [];
  for (let j = 0; j < words.length; j += 1) {
    const a = words[j];
    if (a === '--') break;
    if (create.some(([full, min]) => abbreviates(a, full, min))) {
      const value = a.includes('=') ? a.slice(a.indexOf('=') + 1) : words[(j += 1)];
      if (value !== undefined) created.push(value);
    } else if (valued.includes(a)) j += 1;
    else if (a.startsWith('--')) {
      if (a.split('=')[0].includes(UNKNOWN)) created.push(UNKNOWN);
    } else if (a.startsWith('-') && a !== '-') {
      let at = 1;
      while (at < a.length && /[a-zA-Z0-9]/.test(a[at]) && !shortCreate.includes(a[at])) at += 1;
      if (at < a.length && shortCreate.includes(a[at])) {
        const value = a.slice(at + 1) || words[(j += 1)];
        if (value !== undefined) created.push(value);
      } else if (a[at] === UNKNOWN) created.push(UNKNOWN);
    } else ops.push(a);
  }
  return { created, ops };
}

function analyzeGit(
  args,
  env,
  seg,
  { assignments, dashed = false, aliasDepth = 0, viaXargs = false },
) {
  const { st, role, result, deny, target, opaque, nested } = env;
  let gitBase = st.base;
  const globals = [];
  let k = 0;
  const moveBase = (path) => {
    gitBase =
      path.includes(UNKNOWN) || (gitBase === null && !isAbsolute(path))
        ? null
        : resolve(gitBase, path);
  };
  // Entrées de configuration de la ligne de commande (-c, --config-env), dans l'ordre : { key,
  // value } (value null : booléen sans valeur ; contient UNKNOWN : illisible).
  const cmdline = [];
  /** Valeur d'une variable d'environnement vue par git : variables de la commande, puis du shell. */
  const envValue = (name) => {
    let value = st.vars.get(name) ?? null;
    for (const a of assignments) if (a.startsWith(`${name}=`)) value = a.slice(name.length + 1);
    return value === null || value.includes(UNKNOWN) || name.includes(UNKNOWN) ? null : value;
  };
  const configEnv = (spec) => {
    const at = spec.lastIndexOf('=');
    const key = (at < 0 ? spec : spec.slice(0, at)).trim();
    const what = `git --config-env ${shown(spec)}`;
    // L19-02 : clé illisible ou fichier inclus, qui peuvent fixer core.hooksPath.
    const refusal = configKeyRefusal(key, what);
    if (refusal !== null) {
      deny(refusal);
      return;
    }
    if (at < 0) return; // git refuse la forme sans « = »
    // L25-01 : la valeur est celle de la variable nommée, analysée comme celle de -c.
    const value = envValue(spec.slice(at + 1));
    if (value === null && valueMatters(key))
      deny(
        `${what} : la valeur de ${key} vient d'une variable absente de la commande ou calculée ; ` +
          'git en ferait une commande (ou un alias, ou le transport ext::) : illisible, donc refusée',
      );
    else if (value !== null) configEntry(env, key, value, what, gitBase);
    cmdline.push({ key, value: value ?? UNKNOWN });
  };
  const configValue = (value) => {
    const at = value.indexOf('=');
    const key = (at < 0 ? value : value.slice(0, at)).trim();
    // L19-02 et L25-01 : mêmes refus que les entrées de l'environnement (configEntry), la clé lue
    // comme git 2.30 la lit (blancs autour retirés : `-c ' core.hooksPath=…'`).
    configEntry(env, key, at < 0 ? null : value.slice(at + 1), `git -c ${shown(value)}`, gitBase);
    cmdline.push({ key, value: at < 0 ? null : value.slice(at + 1) });
  };
  for (; k < args.length; k += 1) {
    const a = args[k];
    if (a === '-C' && args[k + 1] !== undefined) {
      moveBase(args[k + 1]);
      globals.push([a, args[k + 1]]);
      k += 1;
    } else if (/^-C./.test(a)) {
      moveBase(a.slice(2));
      globals.push(['-C', a.slice(2)]);
    } else if (a === '-c' && args[k + 1] !== undefined) {
      configValue(args[k + 1]);
      globals.push([a, args[k + 1]]);
      k += 1;
    } else if (/^-c./.test(a)) {
      // T4 : -c collé à sa valeur se lit comme -c séparé.
      configValue(a.slice(2));
      globals.push(['-c', a.slice(2)]);
    } else if (GIT_GLOBAL_VALUED.has(a)) {
      // L19-02 : --config-env <clé>=<variable> fixe la clé comme -c.
      if (a === '--config-env' && args[k + 1] !== undefined) configEnv(args[k + 1]);
      globals.push([a, args[k + 1]]);
      k += 1;
    } else if (a.startsWith('--config-env=')) {
      configEnv(a.slice(13));
      globals.push([a, null]);
    } else if (!a.startsWith('-')) {
      break;
    } else {
      globals.push([a, null]);
    }
  }
  const sub = args[k];
  const rest = args.slice(k + 1);
  const t = (p) => target(p, gitBase);
  if (sub === undefined) return;
  if (sub.includes(UNKNOWN)) {
    deny(`sous-commande git illisible (${shown(sub)}) : illisible, donc refusée`);
    return;
  }
  if (!GIT_COMMANDS.has(sub)) {
    // L25-01 : alias de l'environnement (GIT_CONFIG_*), de la commande et du dépôt, tous analysés.
    const aliases = gitAliases(gitBase, sub, [
      ...envConfigEntries(overlayVars(st.vars, assignments)).entries,
      ...cmdline,
    ]);
    if (aliases.length === 0) {
      deny(
        `git ${sub} n'est ni une commande git connue ni un alias lisible (commande externe ou ` +
          'alias introuvable) : illisible, donc refusé',
      );
      return;
    }
    if (aliasDepth > 8) {
      deny(`alias git ${sub} : boucle d'alias, illisible`);
      return;
    }
    for (const alias of aliases) {
      if (alias.startsWith('!')) {
        nested(`alias git ${sub}`, `${alias.slice(1)} ${rest.map(quote).join(' ')}`, gitBase);
      } else {
        const expansion = [];
        for (const item of parseShell(alias))
          if (item.words) expansion.push(...item.words.map((w) => resolveWord(w, st)));
        const prefix = args.slice(0, k);
        analyzeGit([...prefix, ...expansion, ...rest], env, seg, {
          assignments,
          dashed,
          aliasDepth: aliasDepth + 1,
          viaXargs,
        });
      }
      if (/\bpush\b/.test(alias))
        deny(`un alias qui lance git push (${sub}=${alias}) contourne la règle de push`);
    }
    return;
  }
  /** Écriture d'une référence nommée : refusée si c'est main ou si le nom est illisible. */
  const writesRef = (name, what) => {
    if (name.includes(UNKNOWN))
      deny(
        `${what} : nom de branche illisible (${shown(name)}) ; la branche locale main ne s’écrit ` +
          'pas, illisible donc refusé — écris le nom en clair',
      );
    else if (MAIN_REF.test(name.replace(/^\+/, ''))) deny(`${what} main : ${MAIN_MOTIF}`);
  };
  /** Écriture de la branche courante : refusée si c'est main ou si elle est illisible. */
  /** Dépôt visé illisible : dossier calculé, --git-dir, --work-tree ou variable GIT_DIR… */
  const repoIllegible = () =>
    gitBase === null ||
    globals.some(([o]) => /^--(git-dir|work-tree)(=|$)/.test(o)) ||
    [...assignments, ...st.gitEnv].some((a) => /^GIT_(DIR|WORK_TREE|COMMON_DIR)=/.test(a));
  const onMain = (what) => {
    const branch = repoIllegible() ? UNKNOWN : currentBranch(st, gitBase);
    if (branch.includes(UNKNOWN))
      deny(
        `${what} : branche courante illisible (dossier ou dépôt calculé, ou branche changée par ` +
          'la commande) ; la branche locale main ne s’écrit pas, illisible donc refusé',
      );
    else if (MAIN_REF.test(branch)) deny(`${what} sur la branche main : ${MAIN_MOTIF}`);
  };
  // L18-02 : branche suivie créée par un agent (voir TRACK_MOTIF). Le motif est « faible » : il ne
  // remplace pas un motif déjà posé, plus précis (écriture de main).
  const trackDeny = (what, how) =>
    deny(`${what} : ${how} ; ${TRACK_MOTIF} (rôle ${role}) ; --no-track reste permis`, {
      weak: true,
    });
  /** Configuration lisible par git -C gitBase : pas de dépôt calculé ni de variable GIT_CONFIG*. */
  const configIllegible = () =>
    repoIllegible() || [...assignments, ...st.gitEnv].some((a) => /^GIT_CONFIG/.test(a));
  /**
   * Dernière valeur de `key` donnée par -c ou --config-env (true sans « = » ; UNKNOWN si la
   * variable de --config-env est illisible), sinon undefined.
   */
  const commandConfig = (key) => {
    let value;
    for (const e of cmdline) {
      if (e.key.toLowerCase() === key.toLowerCase()) value = e.value ?? 'true';
    }
    return value;
  };
  /** branch.autoSetupMerge de la commande : false, true, always, inherit, simple ou null (illisible). */
  const autoSetupMerge = () => {
    let value = commandConfig('branch.autoSetupMerge');
    if (value === undefined) {
      if (configIllegible()) return null;
      value = gitOutput(gitBase, ['config', '--get', 'branch.autoSetupMerge']) ?? 'true';
    }
    const v = value.toLowerCase();
    if (['true', 'yes', 'on', '1'].includes(v)) return 'true';
    if (['false', 'no', 'off', '0', ''].includes(v)) return 'false';
    return ['always', 'inherit', 'simple'].includes(v) ? v : null;
  };
  /** La branche locale `name` a un amont (branch.<name>.remote ou .merge). */
  const hasUpstream = (name) =>
    name.includes(UNKNOWN) ||
    gitOutput(gitBase, ['config', '--get', `branch.${name}.remote`]) !== null ||
    gitOutput(gitBase, ['config', '--get', `branch.${name}.merge`]) !== null;
  /**
   * Nature d'un point de départ : remote (branche distante), local, commit (pas une branche),
   * unknown (absent du dépôt à l'analyse, peut-être créé plus loin dans la commande) ; null si
   * illisible. Un nom absent qui commence par un remote du dépôt compte comme distant.
   */
  const startKind = (start) => {
    if (start.includes(UNKNOWN) || repoIllegible()) return null;
    const full = gitOutput(gitBase, ['rev-parse', '--verify', '-q', '--symbolic-full-name', start]);
    if (full === null) {
      const remotes = (gitOutput(gitBase, ['remote']) ?? '').split('\n').filter(Boolean);
      if (
        /^(refs\/)?remotes\//.test(start) ||
        remotes.some((r) => start === r || start.startsWith(`${r}/`))
      )
        return { kind: 'remote', ref: start.replace(/^(refs\/)?remotes\//, '') };
      return { kind: 'unknown', ref: start };
    }
    if (full.startsWith('refs/remotes/')) return { kind: 'remote', ref: full.slice(13) };
    if (full.startsWith('refs/heads/')) return { kind: 'local', ref: full.slice(11) };
    return { kind: 'commit', ref: full };
  };
  /** Le suivi automatique s'applique à la branche `created` partie de `start`. */
  const autoTracks = (start, created) => {
    const mode = autoSetupMerge();
    if (mode === 'false') return false;
    const point = startKind(start);
    if (point?.kind === 'commit') return false;
    if (point === null || mode === null) return true;
    if (mode === 'true') return point.kind === 'remote';
    if (mode === 'always') return true;
    if (mode === 'inherit')
      return point.kind === 'unknown' || (point.kind === 'local' && hasUpstream(point.ref));
    return (
      point.kind === 'remote' && (created.includes(UNKNOWN) || point.ref.endsWith(`/${created}`))
    );
  };
  /** fetch et pull --set-upstream (et ses abréviations) d'un agent : amont de la branche courante. */
  const setUpstream = () => {
    if (role === 'main') return;
    const end = rest.indexOf('--');
    const options = end < 0 ? rest : rest.slice(0, end);
    const word = options.find((a) => abbreviates(a, '--set-upstream', 5));
    if (word !== undefined)
      deny(
        `git ${sub} ${shown(word)} : définir la branche suivie écrit branch.<branche>.remote, hors ` +
          `de la règle des destinations de push : interdit aux agents (rôle ${role})`,
      );
  };
  /** worktree add d'un agent : --track, suivi automatique de -b|-B, branche distante devinée. */
  const worktreeTracking = (add) => {
    const words = creationWords(add, { shortCreate: ['b', 'B'], valued: ['--reason'] });
    const tracking = trackOption(add, ['-b', '-B', '--reason'], ['b', 'B']);
    const last = words.created[words.created.length - 1];
    const [path, commitish] = words.ops;
    if (tracking === 'track') {
      trackDeny('git worktree add --track', 'suivi demandé explicitement');
      return;
    }
    if (
      tracking === 'never' ||
      path === undefined ||
      add.some((a) => a === '-d' || abbreviates(a, '--detach', 4) || a === '--orphan')
    )
      return;
    const what = `git worktree add ${shown(path)}`;
    if (last !== undefined) {
      if (autoTracks(commitish ?? 'HEAD', last))
        trackDeny(
          `${what} -b ${shown(last)}`,
          'point de départ pour lequel le suivi automatique s’applique (branch.autoSetupMerge)',
        );
      return;
    }
    if (commitish !== undefined) {
      if (guessesRemote(commitish))
        trackDeny(`${what} ${shown(commitish)}`, 'branche distante devinée (-b <nom> --no-track)');
      return;
    }
    // Sans point de départ : branche du nom du dossier, devinée avec --guess-remote ou
    // worktree.guessRemote, sinon créée depuis HEAD si elle n'existe pas.
    const name = basename(path);
    if (!name.includes(UNKNOWN) && !repoIllegible()) {
      if (gitOutput(gitBase, ['rev-parse', '--verify', '-q', `refs/heads/${name}`]) !== null)
        return;
    }
    let guess = commandConfig('worktree.guessRemote');
    if (guess?.includes(UNKNOWN)) guess = 'true'; // --config-env illisible : on suppose le pire
    if (guess === undefined)
      guess = configIllegible()
        ? 'true'
        : (gitOutput(gitBase, ['config', '--type=bool', '--get', 'worktree.guessRemote']) ??
          'false');
    const guessing =
      add.some((a) => abbreviates(a, '--guess-remote', 3)) ||
      (!add.some((a) => abbreviates(a, '--no-guess-remote', 6)) &&
        ['true', 'yes', 'on', '1'].includes(guess.toLowerCase()));
    if (guessing && guessesRemote(name))
      trackDeny(what, 'branche distante devinée (--guess-remote, worktree.guessRemote)');
    else if (autoTracks('HEAD', name))
      trackDeny(
        what,
        'branche créée depuis HEAD avec le suivi automatique (branch.autoSetupMerge)',
      );
  };
  /** Branche distante devinée : `name` n'est pas une révision locale et une distante le porte. */
  const guessesRemote = (name) => {
    if (name.includes(UNKNOWN) || repoIllegible()) return true;
    if (name === '-' || gitOutput(gitBase, ['rev-parse', '--verify', '-q', name]) !== null)
      return false;
    const refs = gitOutput(gitBase, ['for-each-ref', '--format=%(refname)', 'refs/remotes/']);
    return (refs ?? '')
      .split('\n')
      .some((r) => r.startsWith('refs/remotes/') && r.split('/').slice(3).join('/') === name);
  };
  /** Refspecs de fetch et pull : une destination main (src:main) écrit la branche locale. */
  const fetchDestinations = (what) => {
    for (const spec of operands(rest, FETCH_VALUED).slice(1)) {
      if (spec.includes(UNKNOWN)) writesRef(spec, what);
      else if (spec.includes(':')) writesRef(spec.slice(spec.lastIndexOf(':') + 1), what);
    }
  };
  const control = (...flags) => rest.some((a) => flags.includes(a));
  /** Texte lu sur l'entrée standard (here-document, redirections), null s'il est illisible. */
  const stdinText = () => {
    let text = seg.heredoc;
    for (const input of seg.inputs) {
      const path = resolveWord(input, st);
      text += path.includes(UNKNOWN)
        ? UNKNOWN
        : (readSmallFile(resolve(gitBase ?? env.cwd, path)) ?? UNKNOWN);
    }
    if (seg.dynamicInput || text.includes(UNKNOWN) || (text === '' && seg.pipedIn)) return null;
    return text;
  };
  if (viaXargs && ['branch', 'update-ref', 'symbolic-ref', 'fetch', 'pull', 'rebase'].includes(sub))
    deny(
      `xargs git ${sub} : références lues sur l’entrée standard ; la branche locale main ne ` +
        's’écrit pas, illisible donc refusé',
    );
  // L25-01 : commande lancée à la place de git-upload-pack (ou de git-upload-archive), en local
  // pour un dépôt local : analysée comme du code shell, comme remote.<nom>.uploadpack.
  if (LAUNCHER_OPTIONS[sub]) {
    const { long, short } = LAUNCHER_OPTIONS[sub];
    for (const code of launcherValues(rest, long, short))
      nested(`git ${sub} ${long[0]}`, code, gitBase);
  }
  switch (sub) {
    case 'push': {
      const refusal = pushRefusal(rest, {
        role,
        globals,
        assignments: [...assignments, ...st.gitEnv],
        dashed,
      });
      if (refusal) deny(refusal);
      break;
    }
    case 'send-pack':
    case 'http-push':
      deny(
        `git ${sub} est une plomberie de push : interdite à tous ; seule la session principale ` +
          `pousse, par git push ${PUSH_REMOTE} ${PUSH_BRANCH}`,
      );
      break;
    case 'svn':
      if (['dcommit', 'set-tree'].includes(rest[0]))
        deny(`git svn ${rest[0]} publie vers un autre dépôt : réservé à Julien`);
      else if (rest[0] === 'rebase') onMain('git svn rebase');
      break;
    case 'p4':
      if (rest[0] === 'submit') deny('git p4 submit publie vers un autre dépôt : réservé à Julien');
      else if (rest[0] === 'rebase') onMain('git p4 rebase');
      break;
    case 'remote': {
      const op = rest.find((a) => !a.startsWith('-'));
      if (op !== undefined && op.includes(UNKNOWN))
        deny(`git remote ${shown(op)} : sous-commande illisible, donc refusée`);
      else if (['add', 'rename', 'remove', 'rm', 'set-url'].includes(op))
        deny(`git remote ${op} ${DESTINATION_MOTIF}`);
      break;
    }
    case 'commit': {
      let dryRun = false;
      for (let j = 0; j < rest.length; j += 1) {
        const a = rest[j];
        if (a === '--dry-run') dryRun = true;
        if (a === '--no-verify') deny('git commit --no-verify est interdit');
        else if (/^-[a-zA-Z]+$/.test(a) && a.includes('n'))
          deny('git commit -n (sans hook) est interdit');
        if (
          [
            '-m',
            '-F',
            '-C',
            '-c',
            '-t',
            '--author',
            '--date',
            '--fixup',
            '--squash',
            '--trailer',
          ].includes(a) ||
          /^-[a-zA-Z]*[mFCct]$/.test(a)
        )
          j += 1;
      }
      // L14-06 (décision du 20 nov. 2026) : le commit écrit la branche courante.
      if (!dryRun) onMain('git commit');
      break;
    }
    case 'citool':
      onMain('git citool');
      break;
    case 'gui':
      if (!['blame', 'browser', 'version'].includes(rest[0])) onMain('git gui');
      break;
    case 'quiltimport':
      if (!control('--dry-run', '-n')) onMain('git quiltimport');
      break;
    case 'fast-import': {
      // Le flux nomme les références qu'il écrit : commit <réf> et reset <réf>.
      const text = stdinText();
      if (text === null) {
        deny(
          'git fast-import : flux lu sur un tube ou calculé ; la branche locale main ne s’écrit ' +
            'pas, illisible donc refusé',
        );
        break;
      }
      for (const line of text.split('\n')) {
        const m = /^(commit|reset) (\S+)/.exec(line);
        if (m) writesRef(m[2], 'git fast-import');
      }
      break;
    }
    case 'replay': {
      // git replay écrit les références par défaut (--ref-action=update, ou replay.refAction) :
      // --ref, --advance et --revert nomment la branche écrite, --onto la déduit du parcours.
      if (rest.includes('--ref-action=print')) break;
      const named = valueOf(rest, ['--ref']);
      const moved = named.length > 0 ? named : valueOf(rest, ['--advance', '--revert']);
      if (moved.length > 0 && !rest.includes('--contained'))
        moved.forEach((b) => writesRef(b, 'git replay'));
      else
        deny(
          'git replay : branches écrites déduites du parcours ; la branche locale main ne ' +
            's’écrit pas, illisible donc refusé (--ref-action=print, ou --ref en clair)',
        );
      break;
    }
    case 'config': {
      // L18-01 : une lecture (--get, get, --list, git config <clé>) est permise, core.hooksPath
      // compris ; seules les écritures sont examinées.
      const write = gitConfigWrite(rest);
      if (write === null) break;
      if (write.keys.some((key) => /^core\.hookspath$/i.test(key)))
        deny('changer core.hooksPath désactive le hook pre-commit');
      if (write.sections.some((section) => /^core$/i.test(section)))
        deny(
          'retirer ou renommer la section core retire core.hooksPath, ce qui désactive le hook ' +
            'pre-commit',
        );
      if (
        rest.some((a) => /^alias\./i.test(a)) &&
        rest.some((a) => !/^alias\./i.test(a) && /\bpush\b/i.test(a))
      )
        deny('un alias qui lance git push contourne la règle de push');
      if (write.edit) {
        deny(`git config --edit : édition libre de la configuration, qui ${DESTINATION_MOTIF}`);
        break;
      }
      for (const key of [...write.keys, ...write.sections]) {
        if (key.includes(UNKNOWN))
          deny(
            `git config : clé illisible (${shown(key)}) ; la destination ne se vérifie pas, donc refusée`,
          );
        else if (
          DESTINATION_KEY.test(key) ||
          (write.sections.includes(key) && DESTINATION_SECTION.test(key))
        )
          deny(`git config ${key} ${DESTINATION_MOTIF}`);
      }
      const key = write.keys[0];
      if (key && COMMAND_CONFIG_KEY.test(key) && write.values[0] !== undefined)
        nested(`git config ${key}`, write.values[0].replace(/^!/, ''), gitBase);
      // L25-01 : protocol.ext.allow ou protocol.allow écrit autrement que never permet ext::.
      if (
        key &&
        PROTOCOL_KEY.test(key) &&
        write.values[0] !== undefined &&
        write.values[0].trim().toLowerCase() !== 'never'
      )
        deny(`git config ${key} ${shown(write.values[0])} : ${EXT_MOTIF}`);
      break;
    }
    case 'rebase': {
      const codes = valueOf(rest, ['-x', '--exec']);
      codes.forEach((c) => nested('git rebase --exec', c, gitBase));
      if (control('--abort', '--quit', '--edit-todo', '--show-current-patch')) break;
      if (rest.includes('--update-refs'))
        deny(
          'git rebase --update-refs : il déplace les branches du parcours, main comprise si elle y ' +
            'est ; la branche locale main ne s’écrit pas, illisible donc refusé',
        );
      // git rebase [--onto <base>] [<amont> [<branche>]] : <branche> est d'abord extraite.
      const ops = operands(
        rest,
        new Set(['--onto', '-x', '--exec', '-s', '--strategy', '-X', '--strategy-option']),
      );
      const branch = rest.includes('--root') ? ops[0] : ops[1];
      if (branch === undefined) onMain('git rebase');
      else {
        writesRef(branch, 'git rebase de la branche');
        setBranch(st, gitBase, branch);
      }
      break;
    }
    case 'merge':
      if (!control('--abort', '--quit')) onMain('git merge');
      break;
    case 'pull':
      fetchDestinations('git pull vers');
      onMain('git pull');
      setUpstream();
      break;
    case 'fetch':
      fetchDestinations('git fetch vers');
      setUpstream();
      break;
    case 'cherry-pick':
    case 'revert':
      if (!control('--abort', '--quit')) onMain(`git ${sub}`);
      break;
    case 'branch': {
      const valued = new Set([
        '--contains',
        '--no-contains',
        '--merged',
        '--no-merged',
        '--points-at',
        '--format',
        '--sort',
        '-u',
        '--set-upstream-to',
      ]);
      const flags = new Set();
      const ops = [];
      let upstream = false;
      for (let j = 0; j < rest.length; j += 1) {
        const a = rest[j];
        if (a === '--') {
          ops.push(...rest.slice(j + 1));
          break;
        }
        // L14-17 (décision de Julien du 20 nov. 2026) : -u et --set-upstream-to écrivent
        // branch.<x>.remote et branch.<x>.merge ; refusés aux agents, sous toutes leurs formes
        // (valeur collée, groupe d'options courtes, abréviation de l'option longue). Un mot
        // illisible pourrait en être une.
        if (
          role !== 'main' &&
          (a.includes(UNKNOWN) || /^--set-u/.test(a) || /^-[a-zA-Z]*u/.test(a))
        ) {
          deny(
            `git branch ${shown(a) || '(mot calculé)'} : définir la branche suivie (-u, --set-upstream-to) écrit ` +
              `branch.<branche>.remote, hors de la règle des destinations de push : interdit aux ` +
              `agents (rôle ${role}) ; option illisible comprise, écris la commande en clair`,
          );
          upstream = true;
          break;
        }
        if (valued.has(a)) {
          flags.add(a);
          j += 1;
        } else if (a.startsWith('--')) {
          // L19-01 : --delete, --move et --copy abrégés (git branch --cop develop main écrit main).
          const name = a.split('=')[0];
          const full = BRANCH_WRITE_OPTIONS.find(([f, min]) => abbreviates(name, f, min));
          flags.add(full ? full[0] : name);
        } else if (/^-[a-zA-Z]+$/.test(a)) for (const c of a.slice(1)) flags.add(`-${c}`);
        else ops.push(a);
      }
      const has = (...names) => names.some((n) => flags.has(n));
      let written = [];
      if (has('-d', '-D', '--delete')) written = ops;
      else if (has('-m', '-M', '--move')) {
        written = ops;
        if (ops.length === 1) onMain('git branch -m');
      } else if (has('-c', '-C', '--copy')) written = ops.slice(-1);
      else if (
        has(
          '-l',
          '--list',
          '-a',
          '--all',
          '-r',
          '--remotes',
          '-v',
          '--verbose',
          '--show-current',
          '--contains',
          '--no-contains',
          '--merged',
          '--no-merged',
          '--points-at',
          '--format',
          '--sort',
          '-u',
          '--set-upstream-to',
          '--unset-upstream',
          '--edit-description',
        )
      )
        written = [];
      else written = ops.slice(0, 1);
      written.forEach((b) => writesRef(b, 'git branch'));
      // L18-02 : --track explicite, copie d'une branche suivie, suivi automatique à la création.
      if (role === 'main' || upstream) break;
      const creating = written.length > 0 && !has('-d', '-D', '--delete', '-m', '-M', '--move');
      const track = trackOption(rest, [...valued], ['u']);
      if (track === 'track') trackDeny('git branch --track', 'suivi demandé explicitement');
      else if (has('-c', '-C', '--copy')) {
        const source =
          ops.length >= 2 ? ops[0] : repoIllegible() ? UNKNOWN : currentBranch(st, gitBase);
        if (repoIllegible() || hasUpstream(source))
          trackDeny(
            'git branch --copy',
            `copie de ${shown(source) || 'la branche courante'}, branche suivie : git copie sa ` +
              'configuration (branch.<branche>.remote)',
          );
      } else if (creating && track !== 'never' && autoTracks(ops[1] ?? 'HEAD', ops[0]))
        trackDeny(
          `git branch ${shown(ops[0])} ${shown(ops[1] ?? 'HEAD')}`,
          'point de départ pour lequel le suivi automatique s’applique (branch.autoSetupMerge)',
        );
      break;
    }
    case 'update-ref': {
      if (rest.includes('--stdin')) {
        const text = stdinText();
        if (text === null) {
          deny(
            'git update-ref --stdin : références lues sur un tube ou calculées ; la branche ' +
              'locale main ne s’écrit pas, illisible donc refusé',
          );
          break;
        }
        for (const line of text.split(/[\n\0]/)) {
          const [verb, ref] = line.trim().split(/\s+/);
          if (
            ref === undefined ||
            verb === 'verify' ||
            !/^(symref-)?(update|create|delete)$/.test(verb)
          )
            continue;
          writesRef(ref, 'git update-ref --stdin');
          if (ref === 'HEAD') onMain('git update-ref --stdin HEAD');
        }
        break;
      }
      const ref = operands(rest, new Set(['-m']))[0];
      if (ref !== undefined) {
        writesRef(ref, 'git update-ref');
        if (ref === 'HEAD' && !rest.includes('--no-deref')) onMain('git update-ref HEAD');
      }
      break;
    }
    case 'symbolic-ref': {
      const ops = operands(rest, new Set(['-m']));
      if (ops.length < 2) break;
      if (ops[0] === 'HEAD') setBranch(st, gitBase, ops[1].replace(/^refs\/heads\//, ''));
      else writesRef(ops[0], 'git symbolic-ref');
      break;
    }
    case 'switch': {
      // L19-01 : nom créé lu à sa place (groupe d'options, valeur collée, options abrégées).
      const creation = creationWords(rest, {
        create: [
          ['--create', 4],
          ['--force-create', 8],
          ['--orphan', 4],
        ],
        shortCreate: ['c', 'C'],
        valued: ['--conflict'],
      });
      const created = creation.created;
      created.forEach((b) => writesRef(b, 'git switch -c'));
      const ops = operands(
        rest,
        new Set(['-c', '-C', '--create', '--force-create', '--orphan', '--conflict']),
      );
      const track =
        rest.some((a) => a === '-t' || a === '--track' || a.startsWith('--track=')) ||
        trackOption(
          rest,
          ['-c', '-C', '--create', '--force-create', '--orphan', '--conflict'],
          ['c', 'C'],
        ) === 'track';
      // L19-01 : switch main sans main locale devine origin/main et crée la branche main.
      const [guess] = creation.ops;
      if (
        created.length === 0 &&
        !track &&
        creation.ops.length === 1 &&
        MAIN_REF.test(guess) &&
        !rest.some(
          (a) => a === '-d' || abbreviates(a, '--detach', 4) || abbreviates(a, '--no-guess', 6),
        ) &&
        commandConfig('checkout.guess')?.toLowerCase() !== 'false' &&
        guessesRemote(guess)
      )
        writesRef(guess, 'git switch (branche distante devinée)');
      if (
        viaXargs &&
        (track || /(^| )(-[cC]|--create|--force-create|--orphan)( |$)/.test(rest.join(' ')))
      )
        deny('xargs git switch : branche créée lue sur l’entrée standard ; illisible, donc refusé');
      if (created.length === 0 && track && ops[0] !== undefined)
        writesRef(trackedName(ops[0]), 'git switch --track');
      if (created.length > 0) setBranch(st, gitBase, created[created.length - 1]);
      else if (control('-d', '--detach')) setBranch(st, gitBase, '');
      else if (viaXargs) setBranch(st, gitBase, UNKNOWN);
      else if (ops[0] !== undefined) setBranch(st, gitBase, ops[0] === '-' ? UNKNOWN : ops[0]);
      // L18-02 : --track explicite, suivi automatique à la création, branche distante devinée.
      if (role === 'main') break;
      const words = creationWords(rest, {
        create: [
          ['--create', 4],
          ['--force-create', 8],
        ],
        shortCreate: ['c', 'C'],
        valued: ['--orphan', '--conflict'],
      });
      const tracking = trackOption(
        rest,
        ['-c', '-C', '--create', '--force-create', '--orphan', '--conflict'],
        ['c', 'C'],
      );
      const last = words.created[words.created.length - 1];
      if (tracking === 'track') trackDeny('git switch --track', 'suivi demandé explicitement');
      else if (tracking === 'never' || rest.some((a) => abbreviates(a, '--orphan', 4))) break;
      else if (last !== undefined) {
        if (autoTracks(words.ops[0] ?? 'HEAD', last))
          trackDeny(
            `git switch -c ${shown(last)} ${shown(words.ops[0] ?? 'HEAD')}`,
            'point de départ pour lequel le suivi automatique s’applique (branch.autoSetupMerge)',
          );
      } else if (
        words.ops.length === 1 &&
        !rest.some(
          (a) => a === '-d' || abbreviates(a, '--detach', 4) || abbreviates(a, '--no-guess', 6),
        ) &&
        commandConfig('checkout.guess')?.toLowerCase() !== 'false' &&
        guessesRemote(words.ops[0])
      )
        trackDeny(
          `git switch ${shown(words.ops[0])}`,
          'branche distante devinée (--no-guess, ou -c <nom> --no-track <départ>)',
        );
      break;
    }
    case 'worktree': {
      const op = rest.find((a) => !a.startsWith('-'));
      if (op !== undefined && op.includes(UNKNOWN)) {
        deny(`git worktree ${shown(op)} : sous-commande illisible, donc refusée`);
        break;
      }
      // L14-13 : un agent ne gère pas les worktrees, l'orchestrateur les lui fournit ; prune et
      // remove --force feraient disparaître sans violation l'instantané d'un worktree (BF-11).
      if (role !== 'main' && ['remove', 'prune', 'move'].includes(op)) {
        deny(
          `git worktree ${op} est réservé à la session principale : un agent ne retire, ne ` +
            'déplace ni n’élague un worktree, l’orchestrateur les fournit et les retire',
        );
        break;
      }
      if (op !== 'add') break;
      const add = rest.slice(rest.indexOf('add') + 1);
      // L19-01 : -b|-B groupé ou collé ; sans -b, branche du nom du dossier (créée si elle n'existe
      // pas en local, --orphan compris) ou branche distante devinée pour <dossier> <nom>.
      const creation = creationWords(add, { shortCreate: ['b', 'B'], valued: ['--reason'] });
      const created = creation.created;
      created.forEach((b) => writesRef(b, 'git worktree add -b'));
      const [newPath, commitish] = creation.ops;
      if (
        created.length === 0 &&
        newPath !== undefined &&
        !add.some((a) => a === '-d' || abbreviates(a, '--detach', 4))
      ) {
        const name = basename(newPath);
        const orphan = add.some((a) => abbreviates(a, '--orphan', 4));
        const local = (b) =>
          !repoIllegible() &&
          gitOutput(gitBase, ['rev-parse', '--verify', '-q', `refs/heads/${b}`]) !== null;
        if (commitish === undefined) {
          if (orphan || name.includes(UNKNOWN) || (MAIN_REF.test(name) && !local(name)))
            writesRef(name, 'git worktree add <dossier> (branche du nom du dossier)');
        } else if (MAIN_REF.test(commitish) && !local(commitish) && guessesRemote(commitish))
          writesRef(commitish, 'git worktree add <dossier> (branche distante devinée)');
      }
      if (role !== 'main') worktreeTracking(add);
      const ops = operands(add, new Set(['-b', '-B', '--reason']));
      if (ops[0] === undefined || gitBase === null || ops[0].includes(UNKNOWN)) break;
      const path = resolve(gitBase, ops[0]);
      let branch = ops[1] ?? basename(path);
      if (control('--detach', '-d')) branch = '';
      if (created.length > 0) branch = created[created.length - 1];
      st.heads.set(path, branch);
      break;
    }
    case 'bisect':
      if (rest[0] === 'run') nested('git bisect run', rest.slice(1).map(quote).join(' '), gitBase);
      break;
    case 'submodule': {
      const at = rest.indexOf('foreach');
      if (at >= 0)
        nested(
          'git submodule foreach',
          rest
            .slice(at + 1)
            .filter((a) => a !== '--recursive' && a !== '-q' && a !== '--quiet')
            .join(' '),
          gitBase,
        );
      break;
    }
    case 'difftool':
    case 'mergetool': {
      valueOf(rest, ['-x', '--extcmd', '-t', '--tool']).forEach((c) =>
        opaque(`git ${sub}`, c, gitBase),
      );
      break;
    }
    case 'update-index':
      if (rest.some((a) => ['--assume-unchanged', '--skip-worktree'].includes(a))) {
        deny('masquer une modification à git (assume-unchanged, skip-worktree) est interdit');
      }
      break;
    case 'filter-branch':
    case 'filter-repo':
    case 'replace':
      deny("la réécriture de l'historique est réservée à Julien");
      break;
    case 'stash':
      if (rest.length === 0)
        deny('git stash nu est interdit (CLAUDE.md) : git stash push -u -m <étiquette>');
      else if (rest[0] === 'branch' && rest[1] !== undefined) {
        writesRef(rest[1], 'git stash branch');
        setBranch(st, gitBase, rest[1]);
      }
      break;
    case 'checkout': {
      const dash = rest.indexOf('--');
      // L19-01 : nom créé lu à sa place (groupe d'options, valeur collée, --orphan abrégé).
      const creation = creationWords(rest, {
        create: [['--orphan', 4]],
        shortCreate: ['b', 'B'],
        valued: ['--conflict', '--pathspec-from-file'],
      });
      const created = creation.created;
      created.forEach((b) => writesRef(b, 'git checkout -b'));
      const track =
        rest.some((a) => a === '-t' || a === '--track' || a.startsWith('--track=')) ||
        trackOption(
          rest,
          ['-b', '-B', '--orphan', '--conflict', '--pathspec-from-file'],
          ['b', 'B'],
        ) === 'track';
      const isPath = (p) =>
        dash < 0 &&
        (p === '.' || /[*?[]/.test(p) || (gitBase !== null && existsSync(resolve(gitBase, p))));
      // L19-01 : checkout main sans main locale devine origin/main et crée la branche main.
      const [guess] = creation.ops;
      if (
        created.length === 0 &&
        !track &&
        creation.ops.length === 1 &&
        MAIN_REF.test(guess) &&
        !isPath(guess) &&
        !rest.some(
          (a) => abbreviates(a, '--detach', 4) || abbreviates(a, '--no-guess', 6) || a === '-p',
        ) &&
        commandConfig('checkout.guess')?.toLowerCase() !== 'false' &&
        guessesRemote(guess)
      )
        writesRef(guess, 'git checkout (branche distante devinée)');
      if (viaXargs && (track || /(^| )(-[bB]|--orphan)( |$)/.test(rest.join(' '))))
        deny(
          'xargs git checkout : branche créée lue sur l’entrée standard ; illisible, donc refusé',
        );
      if (created.length > 0) setBranch(st, gitBase, created[created.length - 1]);
      if (dash >= 0) rest.slice(dash + 1).forEach(t);
      else {
        const ops = operands(
          rest,
          new Set(['-b', '-B', '--orphan', '--conflict', '--pathspec-from-file']),
        );
        const paths = ops.filter(
          (p) =>
            p === '.' ||
            p.includes(UNKNOWN) ||
            /[*?[]/.test(p) ||
            (gitBase !== null && existsSync(resolve(gitBase, p))),
        );
        if (ops.length > 1 || paths.length === ops.length) paths.forEach(t);
        if (created.length === 0 && track && ops[0] !== undefined)
          writesRef(trackedName(ops[0]), 'git checkout --track');
        // Une seule référence et aucun chemin : changement de branche (L14-06).
        if (created.length === 0 && ops.length === 1 && paths.length === 0)
          setBranch(st, gitBase, control('--detach') ? '' : ops[0] === '-' ? UNKNOWN : ops[0]);
        else if (created.length === 0 && viaXargs) setBranch(st, gitBase, UNKNOWN);
      }
      if (rest.some((a) => a.startsWith('--pathspec-from-file')))
        opaque('git checkout', rest.join(' '), gitBase);
      // L18-02 : --track explicite, suivi automatique à la création, branche distante devinée.
      if (role === 'main') break;
      const valued = ['--orphan', '--conflict', '--pathspec-from-file'];
      const words = creationWords(rest, { shortCreate: ['b', 'B'], valued });
      const tracking = trackOption(rest, ['-b', '-B', ...valued], ['b', 'B']);
      const last = words.created[words.created.length - 1];
      const [ref] = words.ops;
      if (tracking === 'track') trackDeny('git checkout --track', 'suivi demandé explicitement');
      else if (tracking === 'never' || rest.some((a) => abbreviates(a, '--orphan', 4))) break;
      else if (last !== undefined) {
        if (autoTracks(ref ?? 'HEAD', last))
          trackDeny(
            `git checkout -b ${shown(last)} ${shown(ref ?? 'HEAD')}`,
            'point de départ pour lequel le suivi automatique s’applique (branch.autoSetupMerge)',
          );
      } else if (
        words.ops.length === 1 &&
        !isPath(ref) &&
        !rest.some(
          (a) => abbreviates(a, '--detach', 4) || abbreviates(a, '--no-guess', 6) || a === '-p',
        ) &&
        commandConfig('checkout.guess')?.toLowerCase() !== 'false' &&
        guessesRemote(ref)
      )
        trackDeny(
          `git checkout ${shown(ref)}`,
          'branche distante devinée (--no-guess, ou -b <nom> --no-track <départ>)',
        );
      break;
    }
    case 'restore':
      operands(rest, new Set(['-s', '--source'])).forEach(t);
      if (rest.some((a) => a.startsWith('--pathspec-from-file')))
        opaque('git restore', rest.join(' '), gitBase);
      break;
    case 'rm':
    case 'mv':
      operands(rest).forEach(t);
      break;
    case 'reset': {
      const dash = rest.indexOf('--');
      if (dash >= 0) rest.slice(dash + 1).forEach(t);
      const ops = operands(dash >= 0 ? rest.slice(0, dash) : rest);
      if (
        rest.some((a) => ['--hard', '--merge', '--keep'].includes(a)) &&
        ops.some((o) => !/^HEAD$/.test(o))
      )
        t('.');
      // L14-06 : un seul opérande, ni HEAD ni un chemin existant, déplace la branche courante
      // (git reset <commit>) ; avec « -- » ou des chemins, seul l'index change.
      const moves =
        viaXargs ||
        (dash < 0 &&
          ops.length === 1 &&
          !/^(HEAD|@)$/.test(ops[0]) &&
          !(gitBase !== null && !ops[0].includes(UNKNOWN) && existsSync(resolve(gitBase, ops[0]))));
      if (moves) onMain('git reset');
      break;
    }
    case 'apply':
    case 'am': {
      const files = operands(rest, new Set(['-p', '-C', '--directory', '--exclude', '--include']));
      const base = gitBase ?? env.cwd;
      const text = files.map((f) => readSmallFile(resolve(base, f)) ?? '').join('\n') + seg.heredoc;
      if (text.trim() === '') opaque(`git ${sub}`, rest.join(' '), gitBase);
      for (const p of patchPaths(text)) {
        if (gitBase === null) {
          deny(
            `git ${sub} dans un dépôt illisible (git -C ou cd calculé) : illisible, donc refusé`,
          );
          break;
        }
        result.repoTargets.push({ path: p, base: gitBase });
        result.writes = true;
      }
      if (
        sub === 'am' &&
        !rest.some((a) => ['--abort', '--quit'].includes(a) || a.startsWith('--show-current-patch'))
      )
        onMain('git am');
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------------------------
// gh (GitHub CLI). Fusionner, étiqueter, publier, supprimer sont réservés à Julien (T5, lot 13 bis).
// Flux par pull request (L20-01, décision de Julien du 21 nov. 2026) : la session principale ouvre
// la pull request d'une branche de lot vers develop, la commente, la relit, l'édite, la passe en
// prête et la fusionne par commit de merge (--merge seulement) ; les agents ne font que lire.
// Pull request vers main (L22-02, décision de Julien du 21 nov. 2026) : de release/<version> vers
// main seulement, créée et fusionnée par la session principale après l'accord explicite de Julien
// (règle de l'orchestrateur, que le hook ne peut pas vérifier). Tout le reste est refusé à tous :
// liste fermée de lectures (GH_READS) et d'écritures de la session principale (GH_PR_WRITES), une
// commande gh qui n'y figure pas est refusée.

const GH_COMMANDS = new Set(
  (
    'accessibility agent-task alias api attestation auth browse cache co codespace completion ' +
    'config copilot extension gist gpg-key help issue label org pr preview project release repo ' +
    'ruleset run search secret ssh-key status variable version workflow'
  ).split(' '),
);
const GH_VALUED = new Set([
  '-R',
  '--repo',
  '--hostname',
  '-X',
  '--method',
  '-q',
  '--jq',
  '-t',
  '--template',
]);
const GH_RESERVED = {
  release: new Set(['create', 'delete', 'delete-asset', 'edit', 'upload']),
  repo: new Set(['delete', 'edit', 'rename', 'archive', 'unarchive', 'sync']),
  alias: new Set(['set', 'import']),
};
/** Lectures permises à toutes les sessions : actions de chaque groupe (null : toute action). */
const GH_READS = {
  pr: new Set(['view', 'list', 'ls', 'checks', 'diff', 'status']),
  issue: new Set(['view', 'list', 'ls', 'status']),
  run: new Set(['view', 'list', 'ls', 'watch']),
  workflow: new Set(['view', 'list', 'ls']),
  release: new Set(['view', 'list', 'ls']),
  repo: new Set(['view', 'list', 'ls']),
  label: new Set(['list', 'ls']),
  cache: new Set(['list', 'ls']),
  secret: new Set(['list', 'ls']),
  variable: new Set(['list', 'ls']),
  ruleset: new Set(['view', 'list', 'ls', 'check']),
  search: new Set(['repos', 'issues', 'prs', 'code', 'commits']),
  auth: new Set(['status']),
  status: null,
  version: null,
  help: null,
};
/** Branche de lot nommée en clair (git flow) : lot/<nom>, un seul niveau. */
export const LOT_BRANCH = /^lot\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** Branche de release (git flow, L22-02) : release/<majeur>.<mineur>.<correctif>, sans zéro de tête. */
export const RELEASE_BRANCH = /^release\/(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
/** Branche d'intégration, base d'une pull request de lot. */
const PR_BASE = 'develop';
/** Branche de production, base d'une pull request de release (L22-02). */
const RELEASE_BASE = 'main';
/** Variables d'environnement de gh qui changent le dépôt ou l'hôte visés. */
const GH_TARGET_ENV = new Set([
  'GH_REPO',
  'GH_HOST',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
]);
// Options permises de chaque écriture de la session principale : [longue, courte, avec valeur].
const GH_TEXT_OPTIONS = [
  ['--title', '-t', true],
  ['--body', '-b', true],
  ['--body-file', '-F', true],
];
const GH_PR_WRITES = {
  create: [
    ...GH_TEXT_OPTIONS,
    ['--base', '-B', true],
    ['--head', '-H', true],
    ['--draft', '-d', false],
    ['--fill', '-f', false],
    ['--fill-first', null, false],
    ['--fill-verbose', null, false],
    ['--label', '-l', true],
    ['--assignee', '-a', true],
    ['--reviewer', '-r', true],
    ['--milestone', '-m', true],
    ['--dry-run', null, false],
    ['--no-maintainer-edit', null, false],
    ['--template', '-T', true],
  ],
  merge: [
    ['--merge', '-m', false],
    ['--subject', '-t', true],
    ['--body', '-b', true],
    ['--body-file', '-F', true],
    ['--match-head-commit', null, true],
    ['--author-email', '-A', true],
  ],
  comment: [
    ['--body', '-b', true],
    ['--body-file', '-F', true],
    ['--edit-last', null, false],
    ['--create-if-none', null, false],
  ],
  review: [
    ['--approve', '-a', false],
    ['--comment', '-c', false],
    ['--request-changes', '-r', false],
    ['--body', '-b', true],
    ['--body-file', '-F', true],
  ],
  edit: [
    ...GH_TEXT_OPTIONS,
    ['--base', '-B', true],
    ['--add-label', null, true],
    ['--remove-label', null, true],
    ['--add-reviewer', null, true],
    ['--remove-reviewer', null, true],
    ['--add-assignee', null, true],
    ['--remove-assignee', null, true],
    ['--milestone', '-m', true],
    ['--remove-milestone', null, false],
  ],
  ready: [['--undo', null, false]],
};
/** Options refusées avec un motif propre : [action ou '*', option longue, courte, motif]. */
const GH_PR_DENIED = [
  ['*', '--repo', '-R', 'vise un autre dépôt que celui du checkout'],
  [
    'merge',
    '--squash',
    '-s',
    'seule la fusion par commit de merge (--merge) est permise, jamais squash',
  ],
  [
    'merge',
    '--rebase',
    '-r',
    'seule la fusion par commit de merge (--merge) est permise, jamais rebase',
  ],
  ['merge', '--admin', null, 'contourne la protection de develop et de main : réservé à Julien'],
  [
    'merge',
    '--delete-branch',
    '-d',
    'supprime la branche distante : réservé à Julien (réglage de suppression automatique de GitHub)',
  ],
  [
    'merge',
    '--auto',
    null,
    'fusion différée : la session principale fusionne elle-même, après CI verte, revue sans point bloquant et recette acceptée',
  ],
  ['merge', '--disable-auto', null, 'la fusion automatique ne sert pas : option refusée'],
  ['comment', '--delete-last', null, 'supprime un commentaire : réservé à Julien'],
  ['comment', '--yes', null, 'confirme une suppression : réservé à Julien'],
  ['*', '--editor', '-e', 'ouvre un éditeur (commande lancée par gh) : écris le texte en option'],
  ['*', '--web', '-w', 'passe par le navigateur, hors de toute vérification : écris la commande'],
  ['*', '--attach', null, 'téléverse un fichier sur GitHub : refusé'],
  ['*', '--recover', null, 'reprend une saisie illisible : écris la commande en entier'],
  ['*', '--project', '-p', 'écrit dans un projet GitHub : refusé'],
  ['*', '--add-project', null, 'écrit dans un projet GitHub : refusé'],
  ['*', '--remove-project', null, 'écrit dans un projet GitHub : refusé'],
];

/** Motif propre d'une option refusée de `gh pr <action>`, ou null. */
function ghDeniedOption(action, name) {
  const hit = GH_PR_DENIED.find(
    ([a, long, short]) => (a === '*' || a === action) && (name === long || name === short),
  );
  return hit ? `gh pr ${action} ${name} : ${hit[3]}` : null;
}

/**
 * Lit les options de `gh pr <action>` (après l'action) selon la liste permise : options et valeurs,
 * arguments, ou le motif d'un refus. Une option inconnue, groupée, ou une option sans valeur écrite
 * avec une valeur (`--merge=false`) est refusée : la commande doit se lire sans ambiguïté.
 */
function ghPrOptions(action, rest) {
  return ghOptions(
    `gh pr ${action}`,
    GH_PR_WRITES[action],
    (name) => ghDeniedOption(action, name),
    rest,
  );
}

/**
 * Lecteur commun des options d'une écriture gh (`label` : la commande, pour les messages ; `spec` :
 * [longue, courte, avec valeur] ; `deniedOf(nom)` : motif propre d'une option refusée, ou null).
 */
function ghOptions(label, spec, deniedOf, rest) {
  const flags = new Map();
  const positionals = [];
  for (let k = 0; k < rest.length; k += 1) {
    const a = rest[k];
    if (a === '--') {
      positionals.push(...rest.slice(k + 1));
      break;
    }
    if (!a.startsWith('-') || a === '-') {
      positionals.push(a);
      continue;
    }
    const long = a.startsWith('--');
    const eq = long ? a.indexOf('=') : -1;
    const name = long ? (eq < 0 ? a : a.slice(0, eq)) : a.slice(0, 2);
    if (name.includes(UNKNOWN))
      return { error: `${label} ${shown(a)} : option illisible, donc refusée` };
    let value = long ? (eq < 0 ? null : a.slice(eq + 1)) : a.length > 2 ? a.slice(2) : null;
    if (!long && value !== null && value.startsWith('=')) value = value.slice(1);
    const denied = deniedOf(name);
    if (denied) return { error: denied };
    const def = spec.find(([l, s]) => name === l || name === s);
    if (def === undefined)
      return {
        error: `${label} ${name} : option non permise (liste fermée des options de cette écriture)`,
      };
    const [key, , valued] = def;
    if (valued && value === null) {
      if (k + 1 >= rest.length)
        return { error: `${label} ${name} : valeur absente, commande illisible` };
      k += 1;
      value = rest[k];
    } else if (!valued && value !== null) {
      return {
        error: `${label} ${shown(a)} : option sans valeur écrite avec une valeur ou groupée ; écris chaque option seule`,
      };
    }
    if (!flags.has(key)) flags.set(key, []);
    flags.get(key).push(value);
  }
  return { flags, positionals };
}

/** Motif du refus d'une écriture `gh pr <action>` de la session principale, ou null. */
function ghPrWriteRefusal(action, args, env, assignments, viaXargs) {
  if (viaXargs)
    return `gh pr ${action} sous xargs : arguments lus sur l'entrée standard, illisible, donc refusé`;
  const names = [...assignments.map((a) => a.slice(0, a.indexOf('='))), ...env.st.vars.keys()];
  const targetEnv = names.find((n) => GH_TARGET_ENV.has(n));
  if (targetEnv)
    return `gh pr ${action} avec la variable ${targetEnv} : elle change le dépôt ou l'hôte visés`;
  const parsed = ghPrOptions(action, args.slice(2));
  if (parsed.error) return parsed.error;
  const { flags, positionals } = parsed;
  const one = (key) => {
    const values = flags.get(key) ?? [];
    if (values.length > 1) return null;
    return values[0];
  };
  if (positionals.some((p) => p.includes(UNKNOWN)))
    return `gh pr ${action} ${positionals.map(shown).join(' ')} : pull request illisible, donc refusée`;
  if (positionals.length > 1)
    return `gh pr ${action} : plusieurs pull requests (${positionals.join(' ')}), une seule à la fois`;
  const base = one('--base');
  if (base === null) return `gh pr ${action} : --base répété, illisible`;
  if (base !== undefined && base !== PR_BASE && !(action === 'create' && base === RELEASE_BASE))
    return (
      `gh pr ${action} --base ${shown(base)} : une pull request de lot vise ${PR_BASE}, jamais une ` +
      `autre branche ; seule une pull request créée depuis release/<version> vise ${RELEASE_BASE}` +
      (action === 'create' ? '' : ', et sa base ne se change pas')
    );
  if (action === 'create') {
    if (positionals.length > 0)
      return `gh pr create ${positionals.join(' ')} : argument non permis`;
    if (base === undefined)
      return (
        `gh pr create sans --base ${PR_BASE} : la base par défaut dépend du dépôt ; écris --base ` +
        `${PR_BASE} (branche de lot) ou --base ${RELEASE_BASE} (branche release/<version>)`
      );
    const head = one('--head');
    const pushNote =
      'une seule fois et en clair (sans lui, gh peut pousser la branche courante lui-même)';
    if (base === RELEASE_BASE) {
      if (typeof head === 'string' && LOT_BRANCH.test(head))
        return `gh pr create --base ${RELEASE_BASE} --head ${head} : une pull request de lot vise ${PR_BASE}`;
      if (typeof head !== 'string' || !RELEASE_BRANCH.test(head))
        return `gh pr create --base ${RELEASE_BASE} : --head release/<majeur>.<mineur>.<correctif> obligatoire, ${pushNote}`;
    } else {
      if (typeof head === 'string' && RELEASE_BRANCH.test(head))
        return `gh pr create --base ${PR_BASE} --head ${head} : une pull request de release vise ${RELEASE_BASE}`;
      if (typeof head !== 'string' || !LOT_BRANCH.test(head))
        return `gh pr create : --head lot/<nom> obligatoire, ${pushNote}`;
    }
  }
  if (action === 'merge') {
    if (!flags.has('--merge'))
      return 'gh pr merge sans --merge : seule la fusion par commit de merge est permise (gh pr merge --merge lot/<nom>)';
    if (
      positionals.length !== 1 ||
      !(LOT_BRANCH.test(positionals[0]) || RELEASE_BRANCH.test(positionals[0]))
    )
      return (
        'gh pr merge : nomme la pull request par sa branche de lot ou de release ' +
        '(gh pr merge --merge lot/<nom> ou release/<majeur>.<mineur>.<correctif>), seule forme ' +
        'dont la base est vérifiée à la création'
      );
  }
  return null;
}

// gh run download (L22-05, décision de Julien du 21 nov. 2026) : la session principale télécharge
// les artefacts d'un run de CI pour en lire les traces, dans son dossier temporaire de session et
// nulle part ailleurs. Le contenu est une donnée : son exécution relève des règles ordinaires
// (script écrit par la même commande, code lu sur un tube… : illisible, donc refusé).
const GH_RUN_DOWNLOAD = [
  ['--dir', '-D', true],
  ['--name', '-n', true],
  ['--pattern', '-p', true],
];
/** Dossier temporaire de session de Claude Code : /tmp/claude-<uid>/<projet>/<session>/scratchpad. */
const SESSION_SCRATCH = /^\/tmp\/claude-[0-9]+\/[^/]+\/[^/]+\/scratchpad(\/|$)/;
const RUN_DOWNLOAD_FORM =
  'gh run download <identifiant> --dir <dossier temporaire de session> [--name <artefact>] [--pattern <motif>]';

/** Vrai si `abs` est dans un dossier temporaire de session (celui du hook ou un reconnu). */
function inSessionScratch(abs, scratch) {
  const inside = (root, p) => p === root || p.startsWith(`${root}/`);
  return (scratch !== null && inside(scratch, abs)) || SESSION_SCRATCH.test(abs);
}

/**
 * Chemin réel de `abs` : le plus proche ancêtre existant résolu (liens symboliques compris), puis
 * le reste du chemin ; null si rien n'est lisible.
 */
function realPathOf(abs) {
  let head = abs;
  const tail = [];
  while (!existsSync(head)) {
    const up = dirname(head);
    if (up === head) return null;
    tail.unshift(basename(head));
    head = up;
  }
  try {
    return { real: join(realpathSync(head), ...tail), existing: realpathSync(head) };
  } catch {
    return null;
  }
}

/** Vrai si `dir` (qui existe) est dans l'arbre de travail d'un dépôt git (dépôt ou worktree). */
function inGitWorkTree(dir) {
  try {
    return (
      execFileSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
      }).trim() === 'true'
    );
  } catch {
    return false;
  }
}

/** Motif du refus de `gh run download` pour la session principale, ou null. */
function ghRunDownloadRefusal(args, env, assignments, viaXargs) {
  const label = 'gh run download';
  if (viaXargs)
    return `${label} sous xargs : arguments lus sur l'entrée standard, illisible, donc refusé`;
  const names = [...assignments.map((a) => a.slice(0, a.indexOf('='))), ...env.st.vars.keys()];
  const targetEnv = names.find((n) => GH_TARGET_ENV.has(n));
  if (targetEnv)
    return `${label} avec la variable ${targetEnv} : elle change le dépôt ou l'hôte visés`;
  const parsed = ghOptions(
    label,
    GH_RUN_DOWNLOAD,
    (name) =>
      name === '--repo' || name === '-R'
        ? `${label} ${name} : vise un autre dépôt que celui du checkout`
        : null,
    args.slice(2),
  );
  if (parsed.error) return parsed.error;
  const { flags, positionals } = parsed;
  if (positionals.some((p) => p.includes(UNKNOWN)))
    return `${label} ${positionals.map(shown).join(' ')} : run illisible, donc refusé`;
  if (positionals.length !== 1 || !/^[0-9]+$/.test(positionals[0]))
    return `${label} : nomme un seul run par son identifiant numérique (${RUN_DOWNLOAD_FORM})`;
  const dirs = flags.get('--dir') ?? [];
  if (dirs.length === 0)
    return (
      `${label} ${positionals[0]} sans --dir : ni une lecture ni une écriture du flux sous cette ` +
      `forme ; gh écrirait dans le dossier courant, dépôt compris (${RUN_DOWNLOAD_FORM})`
    );
  if (dirs.length > 1) return `${label} : --dir répété, illisible`;
  const [dir] = dirs;
  if (dir.includes(UNKNOWN))
    return `${label} --dir ${shown(dir)} : dossier calculé, illisible, donc refusé ; écris le chemin en clair`;
  const abs = resolve(env.st.base ?? env.cwd, dir);
  const scratch = env.scratch === null ? null : resolve(env.scratch);
  const where = realPathOf(abs);
  const realScratch = scratch === null ? null : (realPathOf(scratch)?.real ?? null);
  if (
    !inSessionScratch(abs, scratch) ||
    where === null ||
    !inSessionScratch(where.real, realScratch)
  )
    return (
      `${label} --dir ${dir} : hors du dossier temporaire de session (/tmp/claude-<uid>/…/scratchpad) ; ` +
      'les artefacts de CI ne s’écrivent ni dans le dépôt ni dans un worktree'
    );
  if (inGitWorkTree(where.existing))
    return `${label} --dir ${dir} : dans un dépôt git (clone ou worktree) ; choisis un dossier hors de tout dépôt`;
  env.target(dir);
  return null;
}

// L25-05 (décision de Julien du 22 nov. 2026) : relancer un run de la CI, session principale seule.
const GH_RUN_RERUN = [
  ['--failed', null, false],
  ['--job', null, true],
];
const RUN_RERUN_FORM = 'gh run rerun <identifiant> [--failed] [--job <identifiant de job>]';

/** Motif du refus d'un `gh run rerun` de la session principale, ou null. */
function ghRunRerunRefusal(args, env, assignments, viaXargs) {
  const label = 'gh run rerun';
  if (viaXargs)
    return `${label} sous xargs : arguments lus sur l'entrée standard, illisible, donc refusé`;
  const names = [...assignments.map((a) => a.slice(0, a.indexOf('='))), ...env.st.vars.keys()];
  const targetEnv = names.find((n) => GH_TARGET_ENV.has(n));
  if (targetEnv)
    return `${label} avec la variable ${targetEnv} : elle change le dépôt ou l'hôte visés`;
  const parsed = ghOptions(
    label,
    GH_RUN_RERUN,
    (name) => {
      if (name === '--repo' || name === '-R')
        return `${label} ${name} : vise un autre dépôt que celui du checkout`;
      if (name === '--debug' || name === '-d')
        return `${label} ${name} : journalisation de débogage du run, non permise (${RUN_RERUN_FORM})`;
      return null;
    },
    args.slice(2),
  );
  if (parsed.error) return parsed.error;
  const { flags, positionals } = parsed;
  if (positionals.some((p) => p.includes(UNKNOWN)))
    return `${label} ${positionals.map(shown).join(' ')} : run illisible, donc refusé`;
  if (positionals.length !== 1 || !/^[0-9]+$/.test(positionals[0]))
    return `${label} : nomme un seul run par son identifiant numérique (${RUN_RERUN_FORM})`;
  const jobs = flags.get('--job') ?? [];
  if (jobs.length > 1) return `${label} : --job répété, illisible`;
  if (jobs.some((j) => j.includes(UNKNOWN)))
    return `${label} --job ${shown(jobs[0])} : job illisible, donc refusé`;
  if (jobs.some((j) => !/^[0-9]+$/.test(j)))
    return `${label} --job ${jobs[0]} : identifiant de job numérique attendu (${RUN_RERUN_FORM})`;
  return null;
}

function analyzeGh(args, env, { assignments = [], viaXargs = false } = {}) {
  const { deny, role } = env;
  const ops = operands(args, GH_VALUED);
  const [group, action] = ops;
  if (group === undefined) return;
  if (group.includes(UNKNOWN) || (action !== undefined && action.includes(UNKNOWN))) {
    deny(`gh ${shown(ops.slice(0, 2).join(' '))} : commande illisible, donc refusée`);
    return;
  }
  if (!GH_COMMANDS.has(group)) {
    deny(`gh ${group} : ni une commande gh connue (alias ou extension) ; illisible, donc refusée`);
    return;
  }
  const reserved = `gh ${group} ${action} fusionne, étiquette, publie ou supprime : réservé à Julien`;
  if (GH_RESERVED[group]?.has(action)) {
    deny(reserved);
    return;
  }
  if (action === 'delete' || action === 'delete-asset') {
    deny(reserved);
    return;
  }
  if (group === 'api') {
    const methods = [];
    let fields = false;
    for (let k = 0; k < args.length; k += 1) {
      const a = args[k];
      if (a === '-X' || a === '--method') methods.push(args[k + 1] ?? '');
      else if (a.startsWith('--method=')) methods.push(a.slice(9));
      else if (/^-X./.test(a)) methods.push(a.slice(2));
      else if (
        ['-f', '-F', '--field', '--raw-field', '--input'].includes(a) ||
        /^-[fF]./.test(a) ||
        /^--(field|raw-field|input)=/.test(a)
      )
        fields = true;
    }
    const method = methods.find((m) => m.toUpperCase() !== 'GET');
    if (method !== undefined)
      deny(
        `gh api -X ${shown(method)} : seule la lecture (GET) est permise, le reste est réservé à Julien`,
      );
    else if (fields)
      deny(
        'gh api avec -f, -F, --field, --raw-field ou --input écrit sur GitHub : réservé à Julien',
      );
    return;
  }
  // Groupe seul (gh pr) : aide de gh, sans effet.
  if (action === undefined) return;
  const reads = Object.hasOwn(GH_READS, group) ? GH_READS[group] : undefined;
  if (reads === null) return;
  // gh lit une option inconnue placée avant l'action comme suivie d'une valeur : l'action réelle
  // pourrait alors être un autre mot que celui lu ici. Groupe et action s'écrivent en tête.
  if (args[0] !== group || args[1] !== action) {
    deny(`gh ${group} ${action} : écris gh ${group} ${action} en tête, les options ensuite`);
    return;
  }
  if (reads?.has(action)) return;
  if (group === 'run' && action === 'download') {
    if (role !== 'main') {
      deny(
        `gh run download écrit des fichiers : interdit aux agents (rôle ${role ?? 'inconnu'}) ; ` +
          'seule la session principale télécharge les artefacts de la CI, dans son dossier ' +
          'temporaire de session',
      );
      return;
    }
    const refusal = ghRunDownloadRefusal(args, env, assignments, viaXargs);
    if (refusal) deny(refusal);
    return;
  }
  if (group === 'run' && action === 'rerun') {
    if (role !== 'main') {
      deny(
        `gh run rerun relance la CI sur GitHub : interdit aux agents (rôle ${role ?? 'inconnu'}) ; ` +
          'seule la session principale relance un run',
      );
      return;
    }
    const refusal = ghRunRerunRefusal(args, env, assignments, viaXargs);
    if (refusal) deny(refusal);
    return;
  }
  if (group === 'pr' && Object.hasOwn(GH_PR_WRITES, action)) {
    if (role !== 'main') {
      deny(
        `gh pr ${action} écrit sur GitHub : interdit aux agents (rôle ${role ?? 'inconnu'}) ; seule ` +
          'la session principale ouvre, commente, relit et fusionne les pull requests, les agents ' +
          'ne font que lire',
      );
      return;
    }
    const refusal = ghPrWriteRefusal(action, args, env, assignments, viaXargs);
    if (refusal) deny(refusal);
    return;
  }
  deny(
    `gh ${group} ${action} : ni une lecture ni une écriture du flux par pull request ; refusé ` +
      `(${role === 'main' ? 'session principale' : `rôle ${role ?? 'inconnu'}`})`,
  );
}

/** Vrai si un code opaque contient une primitive d'écriture. */
export function hasWritePrimitive(text) {
  return WRITE_PRIMITIVES.test(text);
}

/** Candidats « chemins » d'un texte libre (script, code en ligne) pour la recherche d'oracles. */
export function pathCandidates(text) {
  const out = new Set();
  for (const m of text.matchAll(/[A-Za-z0-9_@.*\-/]+/g)) {
    const s = m[0].replace(/^\.\//, '');
    if (s.length > 2 && (s.includes('/') || /\.[a-z]{2,5}$/i.test(s))) out.add(s);
  }
  return [...out];
}
