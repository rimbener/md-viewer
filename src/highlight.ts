/**
 * A small syntax highlighter for the languages a fenced block is most often
 * written in here: HTML, CSS and JavaScript/TypeScript.
 *
 * Like the Gherkin reader it is a *reader*, not a compiler. Three properties
 * hold for any input, which is what makes it safe to run on a half-written
 * document: every scan is bounded, nothing is ever rejected, and the token
 * texts always concatenate back into the source exactly.
 */

export type TokenKind =
  | 'text'
  | 'comment'
  | 'keyword'
  | 'string'
  | 'constant'
  | 'tag'
  | 'attribute'
  | 'function';

export interface Token {
  kind: TokenKind;
  text: string;
}

export type Language = 'html' | 'css' | 'js';

/** Fence languages, and the tokenizer each one is read with. */
const LANGUAGES = new Map<string, Language>([
  ['html', 'html'],
  ['htm', 'html'],
  ['css', 'css'],
  ['js', 'js'],
  ['jsx', 'js'],
  ['mjs', 'js'],
  ['cjs', 'js'],
  ['javascript', 'js'],
  ['ts', 'js'],
  ['tsx', 'js'],
  ['typescript', 'js'],
]);

export function languageOf(fence: string | null): Language | null {
  return fence === null ? null : LANGUAGES.get(fence.toLowerCase()) ?? null;
}

export function highlight(source: string, language: Language): Token[] {
  const sink = new Sink();
  switch (language) {
    case 'html':
      tokenizeHtml(source, sink);
      break;
    case 'css':
      tokenizeCss(source, sink);
      break;
    case 'js':
      tokenizeJs(source, sink);
      break;
  }
  return sink.tokens;
}

/** Collects tokens, merging neighbours of one kind into a single run. */
class Sink {
  readonly tokens: Token[] = [];

  push(kind: TokenKind, text: string): void {
    if (text.length === 0) {
      return;
    }
    const last = this.tokens[this.tokens.length - 1];
    if (last !== undefined && last.kind === kind) {
      last.text += text;
      return;
    }
    this.tokens.push({ kind, text });
  }
}

/** Runs a sticky pattern at `start`, returning the match or null. */
function at(pattern: RegExp, source: string, start: number): string | null {
  pattern.lastIndex = start;
  const match = pattern.exec(source);
  return match === null ? null : match[0];
}

/** The index just past `close`, or the end of the source if it never comes. */
function through(source: string, start: number, close: string): number {
  const found = source.indexOf(close, start);
  return found === -1 ? source.length : found + close.length;
}

// --- JavaScript and TypeScript ---------------------------------------------

const JS_KEYWORDS = new Set([
  'abstract',
  'any',
  'as',
  'asserts',
  'async',
  'await',
  'bigint',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'infer',
  'instanceof',
  'interface',
  'is',
  'keyof',
  'let',
  'namespace',
  'never',
  'new',
  'number',
  'object',
  'of',
  'override',
  'private',
  'protected',
  'public',
  'readonly',
  'return',
  'satisfies',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'try',
  'type',
  'typeof',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const JS_LITERALS = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
]);

/** Keywords that stand for a value, so a `/` after one divides. */
const JS_VALUE_KEYWORDS = new Set(['this', 'super']);

/** Keywords that are ordinary names too, so a call beats the keyword. */
const JS_CALLABLE_KEYWORDS = new Set([
  'as',
  'from',
  'get',
  'is',
  'of',
  'set',
  'type',
]);

const JS_IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/y;
const JS_NUMBER =
  /(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.\d[\d_]*(?:[eE][+-]?\d+)?|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?)n?/y;
const JS_CALL = /\s*\(/y;

function tokenizeJs(source: string, sink: Sink): void {
  let index = 0;
  /** Whether the last meaningful token can end an expression. */
  let afterValue = false;
  /** Whether a `.` came just before, which makes the next word a member. */
  let member = false;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '/' && next === '/') {
      const line = source.indexOf('\n', index);
      const end = line === -1 ? source.length : line;
      sink.push('comment', source.slice(index, end));
      index = end;
      continue;
    }

    if (character === '/' && next === '*') {
      const end = through(source, index + 2, '*/');
      sink.push('comment', source.slice(index, end));
      index = end;
      continue;
    }

    if (character === '"' || character === "'") {
      index = readQuoted(source, index, sink);
      afterValue = true;
      member = false;
      continue;
    }

    if (character === '`') {
      index = readTemplate(source, index, sink);
      afterValue = true;
      member = false;
      continue;
    }

    if (character === '/' && !afterValue) {
      const end = readRegex(source, index);
      if (end !== null) {
        sink.push('string', source.slice(index, end));
        index = end;
        afterValue = true;
        member = false;
        continue;
      }
    }

    const number = at(JS_NUMBER, source, index);
    if (number !== null) {
      sink.push('constant', number);
      index += number.length;
      afterValue = true;
      member = false;
      continue;
    }

    const word = at(JS_IDENTIFIER, source, index);
    if (word !== null) {
      index += word.length;
      const called = at(JS_CALL, source, index) !== null;
      const reserved = !member;
      member = false;
      if (reserved && JS_LITERALS.has(word)) {
        sink.push('constant', word);
        afterValue = true;
      } else if (
        reserved &&
        JS_KEYWORDS.has(word) &&
        !(called && JS_CALLABLE_KEYWORDS.has(word))
      ) {
        sink.push('keyword', word);
        afterValue = JS_VALUE_KEYWORDS.has(word);
      } else {
        sink.push(called ? 'function' : 'text', word);
        afterValue = true;
      }
      continue;
    }

    sink.push('text', character);
    index += 1;
    if (!/\s/.test(character)) {
      afterValue = character === ')' || character === ']';
      member = character === '.';
    }
  }
}

/** A single- or double-quoted string; an unterminated one stops at the line. */
function readQuoted(source: string, start: number, sink: Sink): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === quote) {
      index += 1;
      break;
    }
    if (character === '\n') {
      break;
    }
    index += 1;
  }
  const end = Math.min(index, source.length);
  sink.push('string', source.slice(start, end));
  return end;
}

/** A template literal, with each `${…}` tokenized as the code it is. */
function readTemplate(source: string, start: number, sink: Sink): number {
  let index = start + 1;
  let literal = source[start];

  while (index < source.length) {
    const character = source[index];

    if (character === '\\') {
      literal += source.slice(index, index + 2);
      index += 2;
      continue;
    }

    if (character === '`') {
      sink.push('string', literal + character);
      return index + 1;
    }

    if (character === '$' && source[index + 1] === '{') {
      const close = matchingBrace(source, index + 2);
      sink.push('string', `${literal}\${`);
      literal = '';
      tokenizeJs(source.slice(index + 2, close), sink);
      if (close === source.length) {
        return close;
      }
      sink.push('string', '}');
      index = close + 1;
      continue;
    }

    literal += character;
    index += 1;
  }

  sink.push('string', literal);
  return index;
}

/** The `}` closing a brace opened just before `start`, else the source end. */
function matchingBrace(source: string, start: number): number {
  let depth = 1;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return source.length;
}

const REGEX_FLAGS = /[a-z]*/y;

/** The end of a regex literal at `start`, or null when `/` is division. */
function readRegex(source: string, start: number): number | null {
  let inClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\n') {
      return null; // A regex literal never spans a line, but division does.
    }
    if (character === '\\') {
      index += 1;
    } else if (character === '[') {
      inClass = true;
    } else if (character === ']') {
      inClass = false;
    } else if (character === '/' && !inClass) {
      return index + 1 + (at(REGEX_FLAGS, source, index + 1) ?? '').length;
    }
  }
  return null;
}

// --- CSS -------------------------------------------------------------------

/** At-rules whose block holds further rules rather than declarations. */
const CSS_NESTING_AT_RULES = new Set([
  '@container',
  '@document',
  '@keyframes',
  '@layer',
  '@media',
  '@scope',
  '@supports',
]);

type CssState = 'selector' | 'property' | 'value';

const CSS_AT_RULE = /@[A-Za-z-]+/y;
const CSS_SELECTOR = /[.#:]{0,2}[A-Za-z_][A-Za-z0-9_-]*|[.#][A-Za-z0-9_-]+/y;
const CSS_PROPERTY = /--[A-Za-z0-9_-]+|\*?[A-Za-z-][A-Za-z0-9-]*/y;
const CSS_VALUE =
  /--[A-Za-z0-9_-]+|[A-Za-z-][A-Za-z0-9_-]*|#[0-9a-fA-F]{3,8}|[+-]?(?:\d*\.)?\d+[A-Za-z%]*/y;
const CSS_IMPORTANT = /!\s*important/y;

function tokenizeCss(source: string, sink: Sink): void {
  let index = 0;
  let state: CssState = 'selector';
  /** The state each open block was entered from, innermost last. */
  const blocks: CssState[] = [];
  /** An at-rule condition reads as a declaration: `(min-width: 40em)`. */
  let condition: CssState | null = null;
  let depth = 0;
  let prelude = '';

  while (index < source.length) {
    const character = source[index];
    const current = condition ?? state;

    if (character === '/' && source[index + 1] === '*') {
      const close = through(source, index + 2, '*/');
      sink.push('comment', source.slice(index, close));
      index = close;
      continue;
    }

    if (character === '"' || character === "'") {
      index = readQuoted(source, index, sink);
      continue;
    }

    if (character === '(' && state === 'selector') {
      depth += 1;
      condition = condition ?? 'property';
      sink.push('text', character);
      index += 1;
      continue;
    }

    if (character === ')' && condition !== null) {
      depth -= 1;
      if (depth <= 0) {
        condition = null;
        depth = 0;
      }
      sink.push('text', character);
      index += 1;
      continue;
    }

    if (character === '{') {
      blocks.push(state);
      state = CSS_NESTING_AT_RULES.has(prelude) ? 'selector' : 'property';
      condition = null;
      depth = 0;
      prelude = '';
      sink.push('text', character);
      index += 1;
      continue;
    }

    if (character === '}') {
      state = blocks.pop() ?? 'selector';
      condition = null;
      depth = 0;
      sink.push('text', character);
      index += 1;
      continue;
    }

    if (character === ';') {
      state = state === 'value' ? 'property' : state;
      condition = null;
      depth = 0;
      prelude = '';
      sink.push('text', character);
      index += 1;
      continue;
    }

    if (character === ':' && current === 'property') {
      if (condition === null) {
        state = 'value';
      } else {
        condition = 'value';
      }
      sink.push('text', character);
      index += 1;
      continue;
    }

    if (character === '@' && current !== 'value') {
      const rule = at(CSS_AT_RULE, source, index) ?? character;
      prelude = rule;
      sink.push('keyword', rule);
      index += rule.length;
      continue;
    }

    if (character === '!') {
      const important = at(CSS_IMPORTANT, source, index);
      if (important !== null) {
        sink.push('keyword', important);
        index += important.length;
        continue;
      }
    }

    const word = at(
      current === 'selector'
        ? CSS_SELECTOR
        : current === 'property'
        ? CSS_PROPERTY
        : CSS_VALUE,
      source,
      index,
    );
    if (word !== null && word.length > 0) {
      index += word.length;
      if (current === 'value') {
        sink.push(source[index] === '(' ? 'function' : 'constant', word);
      } else {
        sink.push(current === 'selector' ? 'tag' : 'attribute', word);
      }
      continue;
    }

    sink.push('text', character);
    index += 1;
  }
}

// --- HTML ------------------------------------------------------------------

const HTML_TAG_NAME = /[A-Za-z][A-Za-z0-9:_-]*/y;
const HTML_ATTRIBUTE = /[^\s=<>/"'`]+/y;
const HTML_UNQUOTED_VALUE = /[^\s<>"'`]+/y;
const HTML_ENTITY = /&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/y;
/** Elements whose content is another language rather than markup. */
const HTML_RAW_TEXT = new Map<string, Language>([
  ['script', 'js'],
  ['style', 'css'],
]);

function tokenizeHtml(source: string, sink: Sink): void {
  let index = 0;

  while (index < source.length) {
    const open = source.indexOf('<', index);
    if (open === -1) {
      pushHtmlText(source.slice(index), sink);
      return;
    }

    pushHtmlText(source.slice(index, open), sink);

    if (source.startsWith('<!--', open)) {
      const end = through(source, open + 4, '-->');
      sink.push('comment', source.slice(open, end));
      index = end;
      continue;
    }

    if (source.startsWith('<!', open) || source.startsWith('<?', open)) {
      const close = source.indexOf('>', open);
      const end = close === -1 ? source.length : close;
      sink.push('text', source.slice(open, open + 2));
      sink.push('keyword', source.slice(open + 2, end));
      sink.push('text', source.slice(end, end + 1));
      index = end + 1;
      continue;
    }

    const closing = source[open + 1] === '/';
    const name = at(HTML_TAG_NAME, source, open + (closing ? 2 : 1));
    if (name === null) {
      sink.push('text', '<');
      index = open + 1;
      continue;
    }

    index = readTag(source, open, closing, name, sink);

    const embedded = closing
      ? undefined
      : HTML_RAW_TEXT.get(name.toLowerCase());
    if (embedded !== undefined && source[index - 2] !== '/') {
      const end = rawTextEnd(source, index, name);
      const content = source.slice(index, end);
      if (embedded === 'js') {
        tokenizeJs(content, sink);
      } else {
        tokenizeCss(content, sink);
      }
      index = end;
    }
  }
}

/** Text content, with entities picked out of it. */
function pushHtmlText(text: string, sink: Sink): void {
  let index = 0;
  while (index < text.length) {
    const ampersand = text.indexOf('&', index);
    if (ampersand === -1) {
      sink.push('text', text.slice(index));
      return;
    }
    const entity = at(HTML_ENTITY, text, ampersand);
    sink.push('text', text.slice(index, ampersand + (entity === null ? 1 : 0)));
    if (entity !== null) {
      sink.push('constant', entity);
    }
    index = ampersand + (entity === null ? 1 : entity.length);
  }
}

/** Reads `<name attr="value">`, returning the index just past it. */
function readTag(
  source: string,
  start: number,
  closing: boolean,
  name: string,
  sink: Sink,
): number {
  sink.push('text', closing ? '</' : '<');
  sink.push('tag', name);
  let index = start + (closing ? 2 : 1) + name.length;

  while (index < source.length) {
    const character = source[index];

    if (character === '>') {
      sink.push('text', character);
      return index + 1;
    }

    if (character === '"' || character === "'") {
      index = readQuoted(source, index, sink);
      continue;
    }

    if (/[\s=/]/.test(character)) {
      sink.push('text', character);
      index += 1;
      continue;
    }

    const attribute = at(HTML_ATTRIBUTE, source, index);
    if (attribute === null) {
      sink.push('text', character);
      index += 1;
      continue;
    }
    index += attribute.length;
    if (source[index] === '=' && !/["']/.test(source[index + 1] ?? '')) {
      const value = at(HTML_UNQUOTED_VALUE, source, index + 1);
      sink.push('attribute', attribute);
      sink.push('text', '=');
      index += 1;
      if (value !== null) {
        sink.push('string', value);
        index += value.length;
      }
      continue;
    }
    sink.push('attribute', attribute);
  }

  return index;
}

/** Where `<script>`/`<style>` content ends: at its closing tag, or the end. */
function rawTextEnd(source: string, start: number, name: string): number {
  const close = source.toLowerCase().indexOf(`</${name.toLowerCase()}`, start);
  return close === -1 ? source.length : close;
}
