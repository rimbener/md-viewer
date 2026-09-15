/**
 * Inline (span-level) markdown: emphasis, code spans, links and images.
 *
 * The scanner walks the string once, accumulating literal text and handing
 * off to a `read*` helper whenever a character could open a construct. Each
 * helper either claims a slice of the input or returns null, in which case
 * the character is treated as plain text.
 */

import type { InlineNode, LinkDefinitions } from './types';

/** Characters a backslash may escape. */
const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const AUTOLINK =
  /^<((?:[a-zA-Z][a-zA-Z0-9+.-]*:[^<>\s]+)|(?:[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+))>/;

const BARE_URL = /^https?:\/\/[^\s<>]+/;

/**
 * Raw HTML is not rendered, but its tags are dropped rather than shown, so an
 * HTML-wrapped heading in a README still reads as its own text.
 */
const HTML_TAG = /^<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/;
const HTML_COMMENT = /^<!--[\s\S]*?-->/;
const LINE_BREAK_TAG = /^<br\s*\/?>/i;

const ENTITY = /^&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,30});/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  copy: '©',
  reg: '®',
  trade: '™',
  check: '✓',
};

/** Trailing punctuation that is almost always sentence punctuation, not URL. */
const URL_TAIL = /[.,;:!?'"]+$/;

interface Claim {
  node: InlineNode;
  /** Index just past the consumed text. */
  next: number;
}

export function parseInline(
  source: string,
  definitions?: LinkDefinitions,
): InlineNode[] {
  const nodes: InlineNode[] = [];
  let literal = '';

  function flush(): void {
    if (literal.length > 0) {
      nodes.push({ kind: 'text', text: literal });
      literal = '';
    }
  }

  function claim(result: Claim | null): boolean {
    if (result === null) {
      return false;
    }
    flush();
    nodes.push(result.node);
    index = result.next;
    return true;
  }

  let index = 0;
  while (index < source.length) {
    const char = source[index];

    if (char === '\\' && ESCAPABLE.test(source[index + 1] ?? '')) {
      literal += source[index + 1];
      index += 2;
      continue;
    }

    if (char === '`' && claim(readCode(source, index))) {
      continue;
    }

    if (char === '<' && claim(readAutolink(source, index))) {
      continue;
    }

    if (char === '<') {
      const skipped = skipHtml(source, index);
      if (skipped !== null) {
        literal += skipped.text;
        index = skipped.next;
        continue;
      }
    }

    if (char === '&') {
      const entity = readEntity(source, index);
      if (entity !== null) {
        literal += entity.text;
        index = entity.next;
        continue;
      }
    }

    if (
      char === '!' &&
      source[index + 1] === '[' &&
      claim(readLink(source, index + 1, true, definitions))
    ) {
      continue;
    }

    if (char === '[' && claim(readLink(source, index, false, definitions))) {
      continue;
    }

    if (
      (char === '*' || char === '_' || char === '~') &&
      claim(readEmphasis(source, index, definitions))
    ) {
      continue;
    }

    if (
      char === 'h' &&
      isBoundary(literal[literal.length - 1]) &&
      claim(readBareUrl(source, index))
    ) {
      continue;
    }

    literal += char;
    index += 1;
  }

  flush();
  return nodes;
}

/** Consumes an HTML tag or comment, keeping only what it renders as. */
function skipHtml(
  source: string,
  start: number,
): { text: string; next: number } | null {
  const rest = source.slice(start);

  const comment = HTML_COMMENT.exec(rest);
  if (comment !== null) {
    return { text: '', next: start + comment[0].length };
  }

  const tag = HTML_TAG.exec(rest);
  if (tag === null) {
    return null;
  }
  return {
    text: LINE_BREAK_TAG.test(tag[0]) ? '\n' : '',
    next: start + tag[0].length,
  };
}

function readEntity(
  source: string,
  start: number,
): { text: string; next: number } | null {
  const match = ENTITY.exec(source.slice(start));
  if (match === null) {
    return null;
  }
  const body = match[1];
  let text: string | undefined;

  if (body.startsWith('#')) {
    const code = body[1] === 'x' || body[1] === 'X'
      ? parseInt(body.slice(2), 16)
      : parseInt(body.slice(1), 10);
    text = Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : undefined;
  } else {
    text = NAMED_ENTITIES[body.toLowerCase()];
  }

  if (text === undefined) {
    return null;
  }
  return { text, next: start + match[0].length };
}

/** A bare URL only starts at the beginning of a word. */
function isBoundary(previous: string | undefined): boolean {
  return previous === undefined || /[\s(<]/.test(previous);
}

/**
 * Code span delimited by a run of backticks; the closing run must be the
 * same length, so ``a ` b`` keeps its inner backtick.
 */
function readCode(source: string, start: number): Claim | null {
  let openEnd = start;
  while (source[openEnd] === '`') {
    openEnd += 1;
  }
  const fenceLength = openEnd - start;

  let index = openEnd;
  while (index < source.length) {
    if (source[index] !== '`') {
      index += 1;
      continue;
    }
    let runEnd = index;
    while (source[runEnd] === '`') {
      runEnd += 1;
    }
    if (runEnd - index === fenceLength) {
      let text = source.slice(openEnd, index).replace(/\s*\n\s*/g, ' ');
      // A single padding space on both sides is a delimiter, not content.
      if (text.length > 2 && text.startsWith(' ') && text.endsWith(' ')) {
        text = text.slice(1, -1);
      }
      return { node: { kind: 'code', text }, next: runEnd };
    }
    index = runEnd;
  }
  return null;
}

function readAutolink(source: string, start: number): Claim | null {
  const match = AUTOLINK.exec(source.slice(start));
  if (match === null) {
    return null;
  }
  const target = match[1];
  const href = target.includes('@') && !target.includes(':')
    ? `mailto:${target}`
    : target;
  return {
    node: { kind: 'link', href, children: [{ kind: 'text', text: target }] },
    next: start + match[0].length,
  };
}

function readBareUrl(source: string, start: number): Claim | null {
  const match = BARE_URL.exec(source.slice(start));
  if (match === null) {
    return null;
  }
  let url = match[0].replace(URL_TAIL, '');
  // Keep parentheses balanced so "(see https://x.com/a)" excludes the ")".
  while (url.endsWith(')') && countChar(url, ')') > countChar(url, '(')) {
    url = url.slice(0, -1);
  }
  if (url.length === 0) {
    return null;
  }
  return {
    node: { kind: 'link', href: url, children: [{ kind: 'text', text: url }] },
    next: start + url.length,
  };
}

function countChar(text: string, char: string): number {
  let total = 0;
  for (const candidate of text) {
    if (candidate === char) {
      total += 1;
    }
  }
  return total;
}

/**
 * `[label](destination "title")`, `[label][reference]` and the image forms of
 * both. `start` points at the opening bracket.
 */
function readLink(
  source: string,
  start: number,
  isImage: boolean,
  definitions?: LinkDefinitions,
): Claim | null {
  const labelEnd = findLabelEnd(source, start);
  if (labelEnd === -1) {
    return null;
  }
  const label = source.slice(start + 1, labelEnd);

  if (source[labelEnd + 1] === '(') {
    const destination = readDestination(source, labelEnd + 2);
    if (destination !== null) {
      return {
        node: build(label, destination.href, isImage, definitions),
        next: destination.next,
      };
    }
  }

  // Reference form: an explicit [ref], or a collapsed/shortcut [label].
  let reference = label;
  let next = labelEnd + 1;
  if (source[labelEnd + 1] === '[') {
    const referenceEnd = findLabelEnd(source, labelEnd + 1);
    if (referenceEnd === -1) {
      return null;
    }
    const explicit = source.slice(labelEnd + 2, referenceEnd);
    if (explicit.trim().length > 0) {
      reference = explicit;
    }
    next = referenceEnd + 1;
  }

  const href = definitions?.get(normalizeLabel(reference));
  if (href === undefined) {
    return null;
  }
  return { node: build(label, href, isImage, definitions), next };
}

function build(
  label: string,
  href: string,
  isImage: boolean,
  definitions?: LinkDefinitions,
): InlineNode {
  if (isImage) {
    return { kind: 'image', src: href, alt: label };
  }
  return { kind: 'link', href, children: parseInline(label, definitions) };
}

/**
 * Trims the outer whitespace of a run of inline nodes, which is what is left
 * behind once stripped HTML tags stop separating anything.
 */
export function trimInline(nodes: InlineNode[]): InlineNode[] {
  const trimmed = nodes.map(node => ({ ...node }));

  const first = trimmed[0];
  if (first?.kind === 'text') {
    first.text = first.text.replace(/^\s+/, '');
  }
  const last = trimmed[trimmed.length - 1];
  if (last?.kind === 'text') {
    last.text = last.text.replace(/\s+$/, '');
  }

  return trimmed.filter(node => node.kind !== 'text' || node.text.length > 0);
}

/** True when nodes would render as nothing but whitespace. */
export function isBlankInline(nodes: InlineNode[]): boolean {
  return nodes.every(
    node => node.kind === 'text' && node.text.trim().length === 0,
  );
}

export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Index of the `]` closing the bracket at `start`, honouring nesting. */
function findLabelEnd(source: string, start: number): number {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

/** Parses `destination "title")` starting just after the opening paren. */
function readDestination(
  source: string,
  start: number,
): { href: string; next: number } | null {
  let index = start;
  while (/\s/.test(source[index] ?? '')) {
    index += 1;
  }

  let href = '';
  if (source[index] === '<') {
    const close = source.indexOf('>', index + 1);
    if (close === -1) {
      return null;
    }
    href = source.slice(index + 1, close);
    index = close + 1;
  } else {
    let depth = 0;
    while (index < source.length) {
      const char = source[index];
      if (char === '\\' && ESCAPABLE.test(source[index + 1] ?? '')) {
        href += source[index + 1];
        index += 2;
        continue;
      }
      if (/\s/.test(char)) {
        break;
      }
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        if (depth === 0) {
          break;
        }
        depth -= 1;
      }
      href += char;
      index += 1;
    }
  }

  while (/\s/.test(source[index] ?? '')) {
    index += 1;
  }

  // An optional title we parse only so we can skip past it.
  const titleOpen = source[index];
  if (titleOpen === '"' || titleOpen === "'" || titleOpen === '(') {
    const titleClose = titleOpen === '(' ? ')' : titleOpen;
    const end = source.indexOf(titleClose, index + 1);
    if (end === -1) {
      return null;
    }
    index = end + 1;
    while (/\s/.test(source[index] ?? '')) {
      index += 1;
    }
  }

  if (source[index] !== ')') {
    return null;
  }
  return { href, next: index + 1 };
}

/**
 * `*emphasis*`, `**strong**`, `***both***` and `~~strikethrough~~`.
 *
 * Underscores are ignored inside words so `snake_case_names` survive intact.
 */
function readEmphasis(
  source: string,
  start: number,
  definitions?: LinkDefinitions,
): Claim | null {
  const marker = source[start];
  let runEnd = start;
  while (source[runEnd] === marker) {
    runEnd += 1;
  }
  const runLength = runEnd - start;

  let delimiterLength: number;
  if (marker === '~') {
    if (runLength < 2) {
      return null;
    }
    delimiterLength = 2;
  } else {
    delimiterLength = Math.min(runLength, 3);
  }

  const contentStart = start + delimiterLength;
  if (contentStart >= source.length || /\s/.test(source[contentStart])) {
    return null;
  }
  if (marker === '_' && /\w/.test(source[start - 1] ?? '')) {
    return null;
  }

  let index = contentStart;
  while (index < source.length) {
    const char = source[index];

    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '`') {
      const code = readCode(source, index);
      if (code !== null) {
        index = code.next;
        continue;
      }
    }
    if (char !== marker) {
      index += 1;
      continue;
    }

    let closeEnd = index;
    while (source[closeEnd] === marker) {
      closeEnd += 1;
    }
    const closeLength = closeEnd - index;
    const closes =
      delimiterLength === 1
        ? closeLength === 1
        : closeLength >= delimiterLength;

    if (
      closes &&
      index > contentStart &&
      !/\s/.test(source[index - 1]) &&
      !(marker === '_' && /\w/.test(source[index + delimiterLength] ?? ''))
    ) {
      const children = parseInline(
        source.slice(contentStart, index),
        definitions,
      );
      const next = index + delimiterLength;
      if (marker === '~') {
        return { node: { kind: 'strikethrough', children }, next };
      }
      if (delimiterLength === 3) {
        return {
          node: {
            kind: 'strong',
            children: [{ kind: 'emphasis', children }],
          },
          next,
        };
      }
      return {
        node: {
          kind: delimiterLength === 2 ? 'strong' : 'emphasis',
          children,
        },
        next,
      };
    }
    index = closeEnd;
  }
  return null;
}
