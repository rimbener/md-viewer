import { parseInline } from '../src/markdown/parseInline';
import type { InlineNode } from '../src/markdown/types';

/** Renders inline nodes as a compact string so assertions stay readable. */
function outline(nodes: InlineNode[]): string {
  return nodes
    .map(node => {
      switch (node.kind) {
        case 'text':
          return node.text;
        case 'strong':
          return `<b>${outline(node.children)}</b>`;
        case 'emphasis':
          return `<i>${outline(node.children)}</i>`;
        case 'strikethrough':
          return `<s>${outline(node.children)}</s>`;
        case 'code':
          return `<code>${node.text}</code>`;
        case 'link':
          return `<a ${node.href}>${outline(node.children)}</a>`;
        case 'image':
          return `<img ${node.src} "${node.alt}">`;
      }
    })
    .join('');
}

describe('parseInline', () => {
  it('parses the emphasis markers', () => {
    expect(outline(parseInline('**bold** and *italic* and ~~gone~~'))).toBe(
      '<b>bold</b> and <i>italic</i> and <s>gone</s>',
    );
  });

  it('nests emphasis', () => {
    expect(outline(parseInline('*outer **inner** rest*'))).toBe(
      '<i>outer <b>inner</b> rest</i>',
    );
    expect(outline(parseInline('***both***'))).toBe('<b><i>both</i></b>');
  });

  it('leaves underscores inside words alone', () => {
    expect(outline(parseInline('call some_long_name now'))).toBe(
      'call some_long_name now',
    );
    expect(outline(parseInline('_emphasised_ word'))).toBe(
      '<i>emphasised</i> word',
    );
  });

  it('does not treat unpaired or spaced markers as emphasis', () => {
    expect(outline(parseInline('2 * 3 * 4'))).toBe('2 * 3 * 4');
    expect(outline(parseInline('a * b'))).toBe('a * b');
  });

  it('keeps markup inside code spans literal', () => {
    expect(outline(parseInline('use `**not bold**` here'))).toBe(
      'use <code>**not bold**</code> here',
    );
    expect(outline(parseInline('``a ` b``'))).toBe('<code>a ` b</code>');
  });

  it('parses links, images and autolinks', () => {
    expect(outline(parseInline('see [the docs](https://x.dev "title")'))).toBe(
      'see <a https://x.dev>the docs</a>',
    );
    expect(outline(parseInline('![a cat](cat.png)'))).toBe(
      '<img cat.png "a cat">',
    );
    expect(outline(parseInline('<https://x.dev>'))).toBe(
      '<a https://x.dev>https://x.dev</a>',
    );
    expect(outline(parseInline('mail <me@x.dev>'))).toBe(
      'mail <a mailto:me@x.dev>me@x.dev</a>',
    );
  });

  it('links bare urls without swallowing the sentence punctuation', () => {
    expect(outline(parseInline('go to https://x.dev/a, then stop.'))).toBe(
      'go to <a https://x.dev/a>https://x.dev/a</a>, then stop.',
    );
    expect(outline(parseInline('(see https://x.dev/a)'))).toBe(
      '(see <a https://x.dev/a>https://x.dev/a</a>)',
    );
  });

  it('resolves reference links against the definitions', () => {
    const definitions = new Map([['docs', 'https://x.dev']]);
    expect(outline(parseInline('read [the docs][docs]', definitions))).toBe(
      'read <a https://x.dev>the docs</a>',
    );
    expect(outline(parseInline('read [docs][]', definitions))).toBe(
      'read <a https://x.dev>docs</a>',
    );
    expect(outline(parseInline('read [docs]', definitions))).toBe(
      'read <a https://x.dev>docs</a>',
    );
  });

  it('leaves an unresolvable reference as plain text', () => {
    expect(outline(parseInline('read [the docs][missing]'))).toBe(
      'read [the docs][missing]',
    );
  });

  it('drops raw html tags but keeps their text', () => {
    expect(outline(parseInline('<strong>kept</strong> text'))).toBe(
      'kept text',
    );
    expect(outline(parseInline('a<br>b'))).toBe('a\nb');
    expect(outline(parseInline('before<!-- hidden -->after'))).toBe(
      'beforeafter',
    );
    expect(outline(parseInline('1 < 2 and 3 > 2'))).toBe('1 < 2 and 3 > 2');
  });

  it('decodes html entities', () => {
    expect(outline(parseInline('a &amp; b &lt;c&gt; &#65; &unknown;'))).toBe(
      'a & b <c> A &unknown;',
    );
  });

  it('honours backslash escapes', () => {
    expect(outline(parseInline('\\*not emphasis\\*'))).toBe('*not emphasis*');
  });
});
