/**
 * A small Gherkin reader, used to give ```gherkin fences real structure
 * instead of a wall of monospace.
 *
 * It is a *reader*, not a validator: any line it does not recognise becomes
 * description text, so a half-written feature still renders. Only the English
 * keywords are known — `# language:` headers are ignored.
 */

/** Feature > Rule > Scenario > Examples, as nesting depth. */
export type SectionRank = 0 | 1 | 2 | 3;

export type GherkinSpan =
  | { kind: 'text'; text: string }
  /** An `<outline parameter>`, filled in from an Examples row. */
  | { kind: 'parameter'; text: string }
  /** A "quoted string", the other thing a step varies by. */
  | { kind: 'string'; text: string };

export interface GherkinSection {
  kind: 'section';
  /** The keyword as written, e.g. `Scenario Outline`. */
  keyword: string;
  rank: SectionRank;
  name: string;
  tags: string[];
  children: GherkinNode[];
}

export type GherkinNode =
  | GherkinSection
  | { kind: 'step'; keyword: string; spans: GherkinSpan[] }
  | {
      kind: 'table';
      rows: GherkinSpan[][][];
      /** Examples tables name their columns; step data tables do not. */
      header: boolean;
    }
  | { kind: 'docString'; text: string }
  | { kind: 'comment'; text: string }
  | { kind: 'description'; text: string };

/**
 * Keywords that open a section. `Example` is a synonym of `Scenario` and
 * `Scenarios` of `Examples`, which is why the plural has to be looked up as
 * its own entry rather than matched as a prefix.
 *
 * Keywords are capitalised, as Gherkin spells them. Matching them loosely
 * would turn a description line that happens to open with "and" or "given"
 * into a step, and description lines are the common case in a feature file.
 */
const SECTIONS = new Map<string, SectionRank>([
  ['Feature', 0],
  ['Business Need', 0],
  ['Ability', 0],
  ['Rule', 1],
  ['Background', 2],
  ['Scenario', 2],
  ['Example', 2],
  ['Scenario Outline', 2],
  ['Scenario Template', 2],
  ['Examples', 3],
  ['Scenarios', 3],
]);

const STEP = /^(Given|When|Then|And|But)\s+(.*)$/;
const TAG = /^@\S/;
const DOC_STRING = /^"""/;

export function parseGherkin(source: string): GherkinNode[] {
  const root: GherkinNode[] = [];
  const stack: GherkinSection[] = [];
  let tags: string[] = [];
  /** The description node still open, so consecutive lines merge into one. */
  let description: Extract<GherkinNode, { kind: 'description' }> | null = null;

  const children = () =>
    stack.length > 0 ? stack[stack.length - 1].children : root;

  const append = (node: GherkinNode) => {
    if (node.kind !== 'description') {
      description = null;
    }
    children().push(node);
  };

  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (line.length === 0) {
      description = null;
      continue;
    }

    if (DOC_STRING.test(line)) {
      const indent = raw.length - raw.trimStart().length;
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !DOC_STRING.test(lines[index].trim())) {
        body.push(lines[index].slice(indent));
        index += 1;
      }
      append({ kind: 'docString', text: body.join('\n') });
      continue;
    }

    if (line.startsWith('#')) {
      append({ kind: 'comment', text: line.replace(/^#+\s?/, '') });
      continue;
    }

    if (TAG.test(line)) {
      // Tags stand above the section they decorate, and several lines of them
      // decorate the same one.
      tags = tags.concat(line.split(/\s+/).filter(tag => tag.startsWith('@')));
      description = null;
      continue;
    }

    if (line.startsWith('|')) {
      const rows = [parseRow(line)];
      while (
        index + 1 < lines.length &&
        lines[index + 1].trim().startsWith('|')
      ) {
        index += 1;
        rows.push(parseRow(lines[index].trim()));
      }
      const parent = stack[stack.length - 1];
      append({ kind: 'table', rows, header: parent?.rank === 3 });
      continue;
    }

    const section = openSection(line);
    if (section !== null) {
      while (stack.length > 0 && stack[stack.length - 1].rank >= section.rank) {
        stack.pop();
      }
      const node: GherkinSection = { ...section, tags, children: [] };
      tags = [];
      description = null;
      children().push(node);
      stack.push(node);
      continue;
    }

    const step = STEP.exec(line);
    if (step !== null) {
      append({ kind: 'step', keyword: step[1], spans: parseSpans(step[2]) });
      continue;
    }

    if (line.startsWith('*')) {
      append({
        kind: 'step',
        keyword: '*',
        spans: parseSpans(line.slice(1).trim()),
      });
      continue;
    }

    if (description !== null) {
      description.text += `\n${line}`;
      continue;
    }
    description = { kind: 'description', text: line };
    children().push(description);
  }

  return root;
}

/** The section a line opens, if it opens one. */
function openSection(
  line: string,
): {
  kind: 'section';
  keyword: string;
  rank: SectionRank;
  name: string;
} | null {
  const colon = line.indexOf(':');
  if (colon === -1) {
    return null;
  }
  const keyword = line.slice(0, colon).trim();
  const rank = SECTIONS.get(keyword);
  if (rank === undefined) {
    return null;
  }
  return { kind: 'section', keyword, rank, name: line.slice(colon + 1).trim() };
}

/** Splits `| a | b |` into its cells, honouring `\|` and `\\`. */
function parseRow(line: string): GherkinSpan[][] {
  const cells: string[] = [];
  let cell = '';
  // The leading pipe opens the first cell rather than separating two.
  for (let index = 1; index < line.length; index += 1) {
    const character = line[index];
    if (character === '\\' && index + 1 < line.length) {
      index += 1;
      cell += line[index] === 'n' ? '\n' : line[index];
    } else if (character === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell.trim().length > 0) {
    cells.push(cell.trim()); // A row whose final pipe is missing.
  }
  return cells.map(parseSpans);
}

const SPAN = /<[^<>\n]+>|"[^"\n]*"/g;

/** Picks `<parameters>` and "strings" out of a run of step text. */
export function parseSpans(text: string): GherkinSpan[] {
  const spans: GherkinSpan[] = [];
  let last = 0;

  for (const match of text.matchAll(SPAN)) {
    const start = match.index;
    if (start > last) {
      spans.push({ kind: 'text', text: text.slice(last, start) });
    }
    spans.push({
      kind: match[0].startsWith('<') ? 'parameter' : 'string',
      text: match[0],
    });
    last = start + match[0].length;
  }

  if (last < text.length) {
    spans.push({ kind: 'text', text: text.slice(last) });
  }
  return spans;
}

/** Fence languages that mean "this is Gherkin". */
const LANGUAGES = new Set(['gherkin', 'feature', 'cucumber']);

export function isGherkin(language: string | null): boolean {
  return language !== null && LANGUAGES.has(language.toLowerCase());
}
