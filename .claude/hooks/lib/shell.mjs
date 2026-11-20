// Analyse d'une commande shell (bash et zsh, le shell de l'outil Bash) : repère les cibles
// d'écriture (redirections, rm, mv, cp, tee, sed -i, perl -i, dd, git checkout/restore/rm/mv,
// find -delete…), les écritures opaques (interpréteurs avec code en ligne ou script, xargs, git
// apply, patch) et les commandes interdites (--no-verify, core.hooksPath…). git push n'est permis
// qu'à la session principale et sous une seule forme (git flow, décision de Julien du 19 nov. 2026) :
// voir pushRefusal. La plomberie de push, la redéfinition de la destination (git remote, git config)
// et les actions de gh qui fusionnent, étiquettent, publient ou suppriment sont refusées à tous.
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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
 * session principale), qui décide seul du droit de push.
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
  { depth = 0, fallback = null, vars = null, heads = null } = {},
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
          'seule la session principale pousse, par la commande git push origin develop écrite telle quelle',
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
      }),
    );
    opaque(what, code, b);
  };
  const env = {
    command,
    st,
    cwd: home,
    role,
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
      const scope = scopes.pop();
      st.base = scope.base;
      st.vars = scope.vars;
      continue;
    }
    analyzeSegment(item, env);
  }
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
    if (CODE_FILE_ENV.has(name))
      deny(`variable ${name} : elle fait charger un code au démarrage ; illisible, donc refusée`);
    if (
      name === 'NODE_OPTIONS' &&
      /--(require|import|loader|experimental-loader)\b|(^|\s)-r\b/.test(value)
    )
      deny('NODE_OPTIONS qui charge un module : code illisible, donc refusé');
    if (COMMAND_ENV.has(name) && value !== '') nested(`variable ${name}`, value);
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
    case 'readonly':
      for (const a of args) {
        if (ASSIGNMENT.test(a)) assignVar(env, a);
        else if (/^GIT_/.test(a)) st.gitEnv.push(a);
      }
      break;
    case 'unset':
    case 'read':
    case 'mapfile':
    case 'readarray':
    case 'getopts':
      for (const a of operands(
        args,
        new Set(['-d', '-n', '-N', '-p', '-t', '-u', '-C', '-c', '-O', '-s']),
      ))
        st.vars.set(a, null);
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
            'git push origin develop écrite telle quelle',
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
      analyzeGh(args, env);
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

// git push (git flow, décision de Julien du 19 nov. 2026). Seule forme permise, et seulement à la
// session principale (rôle « main », sans agent_type) :
//   git [-C <chemin>] [-c <clé>=<valeur>] push [-u | --set-upstream] origin develop[:develop]
// Tout le reste est refusé avec son motif : rôle d'agent, autre remote, autre branche ou refspec
// (main, HEAD, +…, :…, lot/*, étiquette), push forcé, suppression, plusieurs références, options
// transmises au serveur, refspec absente (git push nu dépend de la configuration). Fusionner dans
// main, créer ou pousser une étiquette, pousser main et déployer sont réservés à Julien.
const PUSH_REMOTE = 'origin';
const PUSH_BRANCH = 'develop';
const PUSH_REFSPECS = new Set([PUSH_BRANCH, `${PUSH_BRANCH}:${PUSH_BRANCH}`]);
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
const PUSH_FORM = `seule la forme git push origin ${PUSH_BRANCH} (avec -u ou --set-upstream au besoin) est permise`;

/** Clés dont l'écriture redéfinit la destination d'un push (T3 du lot 13 bis). */
const DESTINATION_KEY =
  /^(remote\..+|url\..+|push\..+|branch\..+\.(remote|pushremote)|include\..+|includeif\..+)$/i;
const DESTINATION_SECTION = /^(remote|url|push|branch|include|includeif)(\.|$)/i;
/** Clés dont la valeur est une commande lancée par git. */
const COMMAND_CONFIG_KEY =
  /^(core\.(editor|pager|sshcommand|askpass|fsmonitor|gitproxy)|sequence\.editor|diff\.external|gpg\.(.+\.)?program|credential\.(.+\.)?helper|pager\..+|interactive\.difffilter|uploadpack\.packobjectshook|(diff|merge|filter|mergetool|difftool)\..+\.(command|cmd|textconv|clean|smudge|process|driver|path))$/i;
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
    return `${spec} : main est réservée à Julien (fusion des release/* et hotfix/*, push de main)`;
  if (refs.some((r) => r.startsWith('refs/tags/')))
    return `${spec} : les étiquettes de version sont réservées à Julien`;
  if (refs.some((r) => /^HEAD\b/.test(r) || r === '@'))
    return `${spec} : HEAD dépend de la branche courante ; ${PUSH_FORM}`;
  if (refs.some((r) => /^(refs\/heads\/)?lot\//.test(r)))
    return `${spec} : les branches de lot restent locales, seule ${PUSH_BRANCH} se pousse`;
  return `refspec ${spec} refusée : ${PUSH_FORM}`;
}

/** Motif du refus d'un git push, ou null s'il est permis. `globals` : options globales de git. */
function pushRefusal(rest, { role, globals, assignments, dashed }) {
  if (dashed)
    return (
      `git-push appelé directement : écris git push ; seule la session principale pousse, et ` +
      `uniquement ${PUSH_BRANCH} vers ${PUSH_REMOTE}`
    );
  if (role !== 'main') {
    return (
      `git push est interdit aux agents (rôle ${role ?? 'inconnu'}) : seule la session principale ` +
      `pousse, et uniquement ${PUSH_BRANCH} vers ${PUSH_REMOTE}`
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
  if (!PUSH_REFSPECS.has(specs[0])) return refspecRefusal(shown(specs[0]));
  return null;
}

/** Valeur d'un alias git (-c alias.x=… de la commande, puis configuration vue depuis `base`). */
function gitAlias(base, sub, globals) {
  for (const [opt, value] of globals) {
    const m = opt === '-c' && /^alias\.([^=]+)=(.*)$/is.exec(value ?? '');
    if (m && m[1].toLowerCase() === sub.toLowerCase()) return m[2];
  }
  if (base === null) return null;
  try {
    return execFileSync('git', ['-C', base, 'config', '--get', `alias.${sub}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).replace(/\n$/, '');
  } catch {
    return null;
  }
}

/** Écriture git config : clés et sections touchées, ou édition libre ; null pour une lecture. */
function gitConfigWrite(rest) {
  const valued = new Set([
    '-f',
    '--file',
    '--blob',
    '--type',
    '-t',
    '--default',
    '--comment',
    '--value',
  ]);
  const ops = operands(rest, valued);
  const has = (...flags) => rest.some((a) => flags.includes(a));
  if (
    has(
      '--get',
      '--get-all',
      '--get-regexp',
      '--get-urlmatch',
      '--get-color',
      '--get-colorbool',
      '-l',
      '--list',
    )
  )
    return null;
  if (['get', 'list'].includes(ops[0])) return null;
  if (has('--edit', '-e') || ops[0] === 'edit')
    return { edit: true, keys: [], sections: [], values: [] };
  if (['set', 'unset'].includes(ops[0]))
    return { keys: [ops[1] ?? ''], values: ops.slice(2), sections: [] };
  if (['rename-section', 'remove-section'].includes(ops[0]))
    return { keys: [], values: [], sections: ops.slice(1) };
  if (has('--rename-section', '--remove-section')) return { keys: [], values: [], sections: ops };
  if (has('--unset', '--unset-all')) return { keys: [ops[0] ?? ''], values: [], sections: [] };
  if (ops.length >= 2 || has('--add', '--replace-all'))
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

/** Nom de branche locale créée à partir d'une branche distante (checkout ou switch --track). */
function trackedName(ref) {
  return ref.replace(/^(refs\/remotes\/)?[^/]+\//, '');
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
  const configValue = (value) => {
    if (/^core\.hookspath=/i.test(value))
      deny('changer core.hooksPath désactive le hook pre-commit');
    if (/^alias\.[^=]*=.*\bpush\b/is.test(value))
      deny(`un alias qui lance git push (${shown(value)}) contourne la règle de push`);
    const m = /^([^=]+)=(.*)$/s.exec(value);
    if (m && COMMAND_CONFIG_KEY.test(m[1]))
      nested(`git -c ${m[1]}`, m[2].replace(/^!/, ''), gitBase);
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
      globals.push([a, args[k + 1]]);
      k += 1;
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
    const alias = gitAlias(gitBase, sub, globals);
    if (alias === null) {
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
  const onMain = (what) => {
    const illegible =
      gitBase === null ||
      globals.some(([o]) => /^--(git-dir|work-tree)(=|$)/.test(o)) ||
      [...assignments, ...st.gitEnv].some((a) => /^GIT_(DIR|WORK_TREE|COMMON_DIR)=/.test(a));
    const branch = illegible ? UNKNOWN : currentBranch(st, gitBase);
    if (branch.includes(UNKNOWN))
      deny(
        `${what} : branche courante illisible (dossier ou dépôt calculé, ou branche changée par ` +
          'la commande) ; la branche locale main ne s’écrit pas, illisible donc refusé',
      );
    else if (MAIN_REF.test(branch)) deny(`${what} sur la branche main : ${MAIN_MOTIF}`);
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
      if (rest.some((a) => /^core\.hookspath$/i.test(a)))
        deny('changer core.hooksPath désactive le hook pre-commit');
      if (
        rest.some((a) => /^alias\./i.test(a)) &&
        rest.some((a) => !/^alias\./i.test(a) && /\bpush\b/i.test(a))
      )
        deny('un alias qui lance git push contourne la règle de push');
      const write = gitConfigWrite(rest);
      if (write === null) break;
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
      break;
    case 'fetch':
      fetchDestinations('git fetch vers');
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
          break;
        }
        if (valued.has(a)) {
          flags.add(a);
          j += 1;
        } else if (a.startsWith('--')) flags.add(a.split('=')[0]);
        else if (/^-[a-zA-Z]+$/.test(a)) for (const c of a.slice(1)) flags.add(`-${c}`);
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
      const created = valueOf(rest, ['-c', '-C', '--create', '--force-create', '--orphan']);
      created.forEach((b) => writesRef(b, 'git switch -c'));
      const ops = operands(
        rest,
        new Set(['-c', '-C', '--create', '--force-create', '--orphan', '--conflict']),
      );
      const track = rest.some((a) => a === '-t' || a === '--track' || a.startsWith('--track='));
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
      const created = valueOf(add, ['-b', '-B']);
      created.forEach((b) => writesRef(b, 'git worktree add -b'));
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
      const created = valueOf(rest, ['-b', '-B', '--orphan']);
      created.forEach((b) => writesRef(b, 'git checkout -b'));
      const track = rest.some((a) => a === '-t' || a === '--track' || a.startsWith('--track='));
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
// gh (GitHub CLI) : fusionner, étiqueter, publier, supprimer sont réservés à Julien (T5).

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
  pr: new Set(['merge']),
  release: new Set(['create', 'delete', 'delete-asset', 'edit', 'upload']),
  repo: new Set(['delete', 'edit', 'rename', 'archive', 'unarchive', 'sync']),
  alias: new Set(['set', 'import']),
};

function analyzeGh(args, env) {
  const { deny } = env;
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
  }
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
