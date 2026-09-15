/**
 * Syntax tree produced by the markdown parser and consumed by `<Markdown />`.
 */

export type InlineNode =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: InlineNode[] }
  | { kind: 'emphasis'; children: InlineNode[] }
  | { kind: 'strikethrough'; children: InlineNode[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; children: InlineNode[] }
  | { kind: 'image'; src: string; alt: string };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type CellAlignment = 'left' | 'center' | 'right' | null;

export interface ListItem {
  blocks: Block[];
}

export type Block =
  | { kind: 'heading'; level: HeadingLevel; content: InlineNode[] }
  | { kind: 'paragraph'; content: InlineNode[] }
  | { kind: 'codeBlock'; language: string | null; text: string }
  | { kind: 'quote'; blocks: Block[] }
  | {
      kind: 'list';
      ordered: boolean;
      /** First number of an ordered list; always 1 for bulleted lists. */
      start: number;
      /** Loose lists get vertical spacing between items, tight ones do not. */
      loose: boolean;
      items: ListItem[];
    }
  | { kind: 'rule' }
  | {
      kind: 'table';
      header: InlineNode[][];
      alignments: CellAlignment[];
      rows: InlineNode[][][];
    };

/** `[label]: destination` definitions, keyed by lowercased label. */
export type LinkDefinitions = Map<string, string>;
