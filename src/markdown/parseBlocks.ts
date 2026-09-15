/**
 * Block-level markdown: headings, paragraphs, lists, quotes, code fences,
 * tables and rules.
 *
 * The document is normalised into an array of lines once, and every container
 * (a blockquote, a list item) re-enters `parseBlocks` with its own dedented
 * slice of those lines. That keeps nesting arbitrary-deep without any
 * bookkeeping beyond the slice itself.
 */

import {
  isBlankInline,
  normalizeLabel,
  parseInline,
  trimInline,
} from './parseInline';
import type {
  Block,
  CellAlignment,
  HeadingLevel,
  InlineNode,
  LinkDefinitions,
  ListItem,
} from './types';

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^`\s]*)/;
const BLOCKQUOTE = /^ {0,3}>[ \t]?/;
const LIST_ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const TABLE_DELIMITER = /^[ \t]*:?-+:?[ \t]*$/;
const LINK_DEFINITION =
  /^ {0,3}\[([^\]]+)\]:[ \t]*(<[^>]*>|\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/;
const INDENTED_CODE = /^(?: {4}|\t)/;

/** Parses a whole markdown document. */
export function parseMarkdown(source: string): Block[] {
  const lines = stripFrontMatter(normalize(source));
  const definitions: LinkDefinitions = new Map();
  const body = extractDefinitions(lines, definitions);
  return parseBlocks(body, definitions);
}

/** Line endings, tabs and a trailing newline all made predictable. */
function normalize(source: string): string[] {
  return source
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n');
}

/** Drops a leading `---` YAML block, which is metadata rather than content. */
function stripFrontMatter(lines: string[]): string[] {
  if (lines[0]?.trim() !== '---') {
    return lines;
  }
  for (let index = 1; index < lines.length; index += 1) {
    if (/^(---|\.\.\.)[ \t]*$/.test(lines[index])) {
      return lines.slice(index + 1);
    }
  }
  return lines;
}

/**
 * Removes `[label]: destination` lines, recording them for the inline parser.
 * Fenced code is skipped so a definition-looking line inside a sample stays.
 */
function extractDefinitions(
  lines: string[],
  definitions: LinkDefinitions,
): string[] {
  const body: string[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const opening = FENCE.exec(line);
    if (fence === null && opening !== null) {
      fence = opening[2][0];
    } else if (fence !== null && new RegExp(`^ {0,3}\\${fence}{3,}`).test(line)) {
      fence = null;
    }

    const definition = fence === null ? LINK_DEFINITION.exec(line) : null;
    if (definition !== null) {
      definitions.set(
        normalizeLabel(definition[1]),
        definition[2].replace(/^<|>$/g, ''),
      );
      continue;
    }
    body.push(line);
  }
  return body;
}

function parseBlocks(lines: string[], definitions: LinkDefinitions): Block[] {
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const result = readFencedCode(lines, index, fence);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    if (INDENTED_CODE.test(line)) {
      const result = readIndentedCode(lines, index);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    const heading = ATX_HEADING.exec(line);
    if (heading !== null) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length as HeadingLevel,
        content: trimInline(parseInline((heading[2] ?? '').trim(), definitions)),
      });
      index += 1;
      continue;
    }

    if (THEMATIC_BREAK.test(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const result = readQuote(lines, index, definitions);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const result = readList(lines, index, definitions);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    if (startsTable(lines, index)) {
      const result = readTable(lines, index, definitions);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    const result = readParagraph(lines, index, definitions);
    if (result.block !== null) {
      blocks.push(result.block);
    }
    index = result.next;
  }

  return blocks;
}

/** True when a line would open a block other than a paragraph. */
function isBlockStart(line: string): boolean {
  return (
    FENCE.test(line) ||
    ATX_HEADING.test(line) ||
    THEMATIC_BREAK.test(line) ||
    BLOCKQUOTE.test(line) ||
    LIST_ITEM.test(line)
  );
}

function stripIndent(line: string, amount: number): string {
  let removed = 0;
  while (removed < amount && line[removed] === ' ') {
    removed += 1;
  }
  return line.slice(removed);
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function readFencedCode(
  lines: string[],
  start: number,
  fence: RegExpExecArray,
): { block: Block; next: number } {
  const indent = fence[1].length;
  const marker = fence[2][0];
  const closing = new RegExp(`^ {0,3}\\${marker}{${fence[2].length},}[ \\t]*$`);
  const language = fence[3].length > 0 ? fence[3] : null;

  const body: string[] = [];
  let index = start + 1;
  while (index < lines.length && !closing.test(lines[index])) {
    body.push(stripIndent(lines[index], indent));
    index += 1;
  }
  // An unclosed fence runs to the end of the document.
  if (index < lines.length) {
    index += 1;
  }

  return {
    block: { kind: 'codeBlock', language, text: body.join('\n') },
    next: index,
  };
}

function readIndentedCode(
  lines: string[],
  start: number,
): { block: Block; next: number } {
  const body: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      // A blank line only stays if indented code resumes after it.
      let lookahead = index;
      while (lookahead < lines.length && lines[lookahead].trim() === '') {
        lookahead += 1;
      }
      if (lookahead >= lines.length || !INDENTED_CODE.test(lines[lookahead])) {
        break;
      }
      for (let blank = index; blank < lookahead; blank += 1) {
        body.push('');
      }
      index = lookahead;
      continue;
    }
    if (!INDENTED_CODE.test(line)) {
      break;
    }
    body.push(stripIndent(line, 4));
    index += 1;
  }

  return {
    block: { kind: 'codeBlock', language: null, text: body.join('\n') },
    next: index,
  };
}

function readQuote(
  lines: string[],
  start: number,
  definitions: LinkDefinitions,
): { block: Block; next: number } {
  const content: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (BLOCKQUOTE.test(line)) {
      content.push(line.replace(BLOCKQUOTE, ''));
      index += 1;
      continue;
    }
    // A plain line continues the quote's paragraph ("lazy continuation").
    if (line.trim() === '' || isBlockStart(line)) {
      break;
    }
    content.push(line);
    index += 1;
  }

  return {
    block: { kind: 'quote', blocks: parseBlocks(content, definitions) },
    next: index,
  };
}

function isOrdered(marker: string): boolean {
  return /\d/.test(marker[0]);
}

function readList(
  lines: string[],
  start: number,
  definitions: LinkDefinitions,
): { block: Block; next: number } {
  const first = LIST_ITEM.exec(lines[start]) as RegExpExecArray;
  const ordered = isOrdered(first[2]);
  const startNumber = ordered ? parseInt(first[2], 10) : 1;
  const listIndent = first[1].length;

  const items: ListItem[] = [];
  let loose = false;
  let index = start;

  while (index < lines.length) {
    const match = LIST_ITEM.exec(lines[index]);
    if (
      match === null ||
      isOrdered(match[2]) !== ordered ||
      match[1].length > listIndent + 3
    ) {
      break;
    }

    const markerIndent = match[1].length;
    const contentIndent =
      markerIndent + match[2].length + Math.max(match[3].length, 1);

    // The marker itself is not indentation, so this first line slices rather
    // than strips.
    const itemLines = [lines[index].slice(contentIndent)];
    index += 1;

    let previousWasBlank = false;
    while (index < lines.length) {
      const line = lines[index];
      if (line.trim() === '') {
        itemLines.push('');
        previousWasBlank = true;
        index += 1;
        continue;
      }
      if (indentOf(line) >= contentIndent) {
        itemLines.push(stripIndent(line, contentIndent));
        previousWasBlank = false;
        index += 1;
        continue;
      }
      // Under-indented: only an unbroken paragraph may continue here.
      if (previousWasBlank || isBlockStart(line) || startsTable(lines, index)) {
        break;
      }
      itemLines.push(line.trimStart());
      index += 1;
    }

    let trailingBlanks = 0;
    while (itemLines.length > 0 && itemLines[itemLines.length - 1] === '') {
      itemLines.pop();
      trailingBlanks += 1;
    }
    if (itemLines.includes('')) {
      loose = true;
    }
    if (trailingBlanks > 0 && index < lines.length && continuesList(lines[index], ordered, listIndent)) {
      loose = true;
    }

    items.push({ blocks: parseBlocks(itemLines, definitions) });
  }

  return {
    block: { kind: 'list', ordered, start: startNumber, loose, items },
    next: index,
  };
}

function continuesList(
  line: string,
  ordered: boolean,
  listIndent: number,
): boolean {
  const match = LIST_ITEM.exec(line);
  return (
    match !== null &&
    isOrdered(match[2]) === ordered &&
    match[1].length <= listIndent + 3
  );
}

/** A table needs a header row and a `---|---` delimiter directly beneath it. */
function startsTable(lines: string[], index: number): boolean {
  const header = lines[index];
  const delimiter = lines[index + 1];
  if (
    header === undefined ||
    delimiter === undefined ||
    !header.includes('|') ||
    !delimiter.includes('-')
  ) {
    return false;
  }
  const cells = splitRow(delimiter);
  return (
    cells.length === splitRow(header).length &&
    cells.every(cell => TABLE_DELIMITER.test(cell))
  );
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/([^\\])\|$/, '$1');
  const cells: string[] = [];
  let current = '';

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '\\' && trimmed[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function readTable(
  lines: string[],
  start: number,
  definitions: LinkDefinitions,
): { block: Block; next: number } {
  const header = splitRow(lines[start]);
  const alignments: CellAlignment[] = splitRow(lines[start + 1]).map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) {
      return 'center';
    }
    if (right) {
      return 'right';
    }
    return left ? 'left' : null;
  });

  const rows: InlineNode[][][] = [];
  let index = start + 2;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '' || !line.includes('|') || isBlockStart(line)) {
      break;
    }
    const cells = splitRow(line);
    rows.push(
      header.map((_, column) =>
        parseInline(cells[column] ?? '', definitions),
      ),
    );
    index += 1;
  }

  return {
    block: {
      kind: 'table',
      header: header.map(cell => parseInline(cell, definitions)),
      alignments,
      rows,
    },
    next: index,
  };
}

function readParagraph(
  lines: string[],
  start: number,
  definitions: LinkDefinitions,
): { block: Block | null; next: number } {
  const buffer: string[] = [lines[start]];
  let index = start + 1;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      break;
    }

    // `===` or `---` under a paragraph turns it into a heading.
    const setext = SETEXT.exec(line);
    if (setext !== null) {
      return {
        block: {
          kind: 'heading',
          level: setext[1][0] === '=' ? 1 : 2,
          content: trimInline(parseInline(joinLines(buffer), definitions)),
        },
        next: index + 1,
      };
    }

    if (isBlockStart(line) || startsTable(lines, index)) {
      break;
    }
    buffer.push(line);
    index += 1;
  }

  // Stripped HTML can leave a paragraph holding nothing but whitespace.
  const content = trimInline(parseInline(joinLines(buffer), definitions));
  return {
    block: isBlankInline(content) ? null : { kind: 'paragraph', content },
    next: index,
  };
}

/**
 * Soft line breaks collapse to a space; a line ending in two spaces or a
 * backslash is a hard break and keeps its newline.
 */
function joinLines(lines: string[]): string {
  return lines
    .map((line, position) => {
      const text = line.trim();
      if (position === lines.length - 1) {
        return text;
      }
      const hard = / {2,}$/.test(line) || text.endsWith('\\');
      return hard ? `${text.replace(/\\$/, '')}\n` : `${text} `;
    })
    .join('');
}
