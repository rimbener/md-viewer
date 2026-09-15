import { parseMarkdown } from '../src/markdown/parseBlocks';
import type { Block, InlineNode } from '../src/markdown/types';

function text(nodes: InlineNode[]): string {
  return nodes
    .map(node => {
      switch (node.kind) {
        case 'text':
          return node.text;
        case 'code':
          return node.text;
        case 'image':
          return node.alt;
        default:
          return text(node.children);
      }
    })
    .join('');
}

/** Renders a block tree as indented lines, which asserts far more readably. */
function outline(blocks: Block[], depth = 0): string[] {
  const pad = '  '.repeat(depth);
  return blocks.flatMap((block): string[] => {
    switch (block.kind) {
      case 'heading':
        return [`${pad}h${block.level}: ${text(block.content)}`];
      case 'paragraph':
        return [`${pad}p: ${text(block.content)}`];
      case 'codeBlock':
        return [`${pad}code[${block.language ?? ''}]: ${block.text}`];
      case 'rule':
        return [`${pad}rule`];
      case 'quote':
        return [`${pad}quote`, ...outline(block.blocks, depth + 1)];
      case 'list':
        return [
          `${pad}list[${block.ordered ? `ordered:${block.start}` : 'bullet'}${
            block.loose ? ',loose' : ''
          }]`,
          ...block.items.flatMap(item => outline(item.blocks, depth + 1)),
        ];
      case 'table':
        return [
          `${pad}table[${block.alignments.join(',')}]`,
          `${pad}  head: ${block.header.map(text).join(' | ')}`,
          ...block.rows.map(row => `${pad}  row: ${row.map(text).join(' | ')}`),
        ];
    }
  });
}

describe('parseMarkdown', () => {
  it('parses headings in both syntaxes', () => {
    expect(
      outline(parseMarkdown('# One\n\n### Three ###\n\nSetext\n======')),
    ).toEqual(['h1: One', 'h3: Three', 'h1: Setext']);
  });

  it('joins a paragraph onto one line, keeping hard breaks', () => {
    expect(outline(parseMarkdown('one\ntwo'))).toEqual(['p: one two']);
    expect(outline(parseMarkdown('one  \ntwo'))).toEqual(['p: one\ntwo']);
  });

  it('parses fenced code without touching its contents', () => {
    const source = '```ts\nconst a = 1;\n\n  # not a heading\n```';
    expect(outline(parseMarkdown(source))).toEqual([
      'code[ts]: const a = 1;\n\n  # not a heading',
    ]);
  });

  it('parses an unclosed fence to the end of the document', () => {
    expect(outline(parseMarkdown('```\nstill code'))).toEqual([
      'code[]: still code',
    ]);
  });

  it('parses indented code blocks', () => {
    expect(outline(parseMarkdown('text\n\n    indented\n\nafter'))).toEqual([
      'p: text',
      'code[]: indented',
      'p: after',
    ]);
  });

  it('separates rules from setext headings', () => {
    expect(outline(parseMarkdown('---\n\ntext\n\n***'))).toEqual([
      'rule',
      'p: text',
      'rule',
    ]);
    expect(outline(parseMarkdown('Title\n---'))).toEqual(['h2: Title']);
  });

  it('parses nested lists', () => {
    const source = '- one\n- two\n  - nested\n- three';
    expect(outline(parseMarkdown(source))).toEqual([
      'list[bullet]',
      '  p: one',
      '  p: two',
      '  list[bullet]',
      '    p: nested',
      '  p: three',
    ]);
  });

  it('marks lists separated by blank lines as loose', () => {
    expect(outline(parseMarkdown('- one\n\n- two'))).toEqual([
      'list[bullet,loose]',
      '  p: one',
      '  p: two',
    ]);
    expect(outline(parseMarkdown('- one\n- two'))).toEqual([
      'list[bullet]',
      '  p: one',
      '  p: two',
    ]);
  });

  it('keeps the starting number of an ordered list', () => {
    expect(outline(parseMarkdown('3. three\n4. four'))).toEqual([
      'list[ordered:3]',
      '  p: three',
      '  p: four',
    ]);
  });

  it('starts a new list when the marker type changes', () => {
    expect(outline(parseMarkdown('- bullet\n1. number'))).toEqual([
      'list[bullet]',
      '  p: bullet',
      'list[ordered:1]',
      '  p: number',
    ]);
  });

  it('parses multi-block list items', () => {
    const source = '- first\n\n  more text\n\n- second';
    expect(outline(parseMarkdown(source))).toEqual([
      'list[bullet,loose]',
      '  p: first',
      '  p: more text',
      '  p: second',
    ]);
  });

  it('parses blockquotes, including lazy continuation and nesting', () => {
    expect(outline(parseMarkdown('> quoted\ncontinued'))).toEqual([
      'quote',
      '  p: quoted continued',
    ]);
    expect(outline(parseMarkdown('> outer\n> > inner'))).toEqual([
      'quote',
      '  p: outer',
      '  quote',
      '    p: inner',
    ]);
  });

  it('parses tables with alignments', () => {
    const source = '| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |';
    expect(outline(parseMarkdown(source))).toEqual([
      'table[left,center,right]',
      '  head: a | b | c',
      '  row: 1 | 2 | 3',
    ]);
  });

  it('pads short table rows and ignores a mismatched delimiter', () => {
    expect(
      outline(parseMarkdown('| a | b |\n| --- | --- |\n| 1 |')),
    ).toEqual(['table[,]', '  head: a | b', '  row: 1 | ']);

    expect(outline(parseMarkdown('| a | b |\n| --- |'))).toEqual([
      'p: | a | b | | --- |',
    ]);
  });

  it('drops YAML front matter', () => {
    expect(outline(parseMarkdown('---\ntitle: x\n---\n\n# Real'))).toEqual([
      'h1: Real',
    ]);
  });

  it('removes link definitions and resolves references to them', () => {
    const blocks = parseMarkdown('See [docs][d].\n\n[d]: https://x.dev\n');
    expect(outline(blocks)).toEqual(['p: See docs.']);
    const paragraph = blocks[0];
    if (paragraph.kind !== 'paragraph') {
      throw new Error('expected a paragraph');
    }
    expect(paragraph.content[1]).toMatchObject({
      kind: 'link',
      href: 'https://x.dev',
    });
  });

  it('keeps a definition-shaped line inside fenced code', () => {
    expect(outline(parseMarkdown('```\n[d]: https://x.dev\n```'))).toEqual([
      'code[]: [d]: https://x.dev',
    ]);
  });

  it('lets a heading interrupt a paragraph', () => {
    expect(outline(parseMarkdown('text\n# heading'))).toEqual([
      'p: text',
      'h1: heading',
    ]);
  });

  it('drops a paragraph left empty by stripped html', () => {
    expect(outline(parseMarkdown('<p align="center">\n<img src="x.png">\n</p>'))).toEqual([]);
    expect(outline(parseMarkdown('<h1>Title</h1>'))).toEqual(['p: Title']);
  });

  it('returns nothing for an empty document', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n  \n')).toEqual([]);
  });
});
