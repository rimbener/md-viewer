import { highlight, languageOf, type Token } from '../src/highlight';

/** The tinted tokens as `kind:text`, which is what a test cares about. */
function marks(tokens: Token[]): string[] {
  return tokens
    .filter(token => token.kind !== 'text')
    .map(token => `${token.kind}:${token.text}`);
}

function source(tokens: Token[]): string {
  return tokens.map(token => token.text).join('');
}

describe('languageOf', () => {
  it('reads the fences of the three languages it knows, in any case', () => {
    expect(languageOf('HTML')).toBe('html');
    expect(languageOf('css')).toBe('css');
    expect(languageOf('tsx')).toBe('js');
    expect(languageOf('javascript')).toBe('js');
  });

  it('claims nothing it cannot read', () => {
    expect(languageOf('python')).toBeNull();
    expect(languageOf('')).toBeNull();
    expect(languageOf(null)).toBeNull();
  });
});

describe('highlight(js)', () => {
  it('marks keywords, names being called, numbers and literals', () => {
    expect(marks(highlight('export const n = add(1, true);', 'js'))).toEqual([
      'keyword:export',
      'keyword:const',
      'function:add',
      'constant:1',
      'constant:true',
    ]);
  });

  it('marks both kinds of comment, to the end of the line or the block', () => {
    expect(
      marks(highlight('// one\ncode\n/* two\nthree */ code', 'js')),
    ).toEqual(['comment:// one', 'comment:/* two\nthree */']);
  });

  it('keeps an unterminated string to its own line', () => {
    expect(marks(highlight("const a = 'open\nconst b = 2;", 'js'))).toEqual([
      'keyword:const',
      "string:'open",
      'keyword:const',
      'constant:2',
    ]);
  });

  it('reads a template literal as string around live interpolations', () => {
    expect(marks(highlight('`a ${count + 1} b`', 'js'))).toEqual([
      'string:`a ${',
      'constant:1',
      'string:} b`',
    ]);
  });

  it('tells a regex literal from a division', () => {
    expect(marks(highlight('text.replace(/["/]+/g, "")', 'js'))).toEqual([
      'function:replace',
      'string:/["/]+/g',
      'string:""',
    ]);
    expect(marks(highlight('const half = total / 2;', 'js'))).toEqual([
      'keyword:const',
      'constant:2',
    ]);
  });

  it('marks TypeScript types as the keywords they are', () => {
    expect(
      marks(highlight('interface A { id: string; size?: number }', 'js')),
    ).toEqual(['keyword:interface', 'keyword:string', 'keyword:number']);
  });

  it('prefers the call to the keyword for names that are both', () => {
    expect(
      marks(highlight('get(key); import type { A } from "b";', 'js')),
    ).toEqual([
      'function:get',
      'keyword:import',
      'keyword:type',
      'keyword:from',
      'string:"b"',
    ]);
  });

  it('reads a keyword after a dot as the member it is', () => {
    expect(
      marks(highlight('promise.catch(log).default = new Map();', 'js')),
    ).toEqual(['function:catch', 'keyword:new', 'function:Map']);
  });
});

describe('highlight(css)', () => {
  it('separates selectors, properties and values', () => {
    expect(
      marks(highlight('.card:hover { margin-top: 10px; color: #fff }', 'css')),
    ).toEqual([
      'tag:.card:hover',
      'attribute:margin-top',
      'constant:10px',
      'attribute:color',
      'constant:#fff',
    ]);
  });

  it('marks at-rules, functions and !important', () => {
    expect(
      marks(
        highlight(
          '@media (min-width: 40em) { a { color: rgb(0 0 0) !important } }',
          'css',
        ),
      ),
    ).toEqual([
      'keyword:@media',
      'attribute:min-width',
      'constant:40em',
      'tag:a',
      'attribute:color',
      'function:rgb',
      'constant:0',
      'constant:0',
      'constant:0',
      'keyword:!important',
    ]);
  });

  it('reads the selectors inside a nesting at-rule as selectors', () => {
    expect(
      marks(highlight('@media print { body { color: red } }', 'css')),
    ).toEqual([
      'keyword:@media',
      'tag:print',
      'tag:body',
      'attribute:color',
      'constant:red',
    ]);
  });

  it('marks comments and quoted values', () => {
    expect(marks(highlight('/* note */ a { content: "x" }', 'css'))).toEqual([
      'comment:/* note */',
      'tag:a',
      'attribute:content',
      'string:"x"',
    ]);
  });
});

describe('highlight(html)', () => {
  it('separates tag names, attribute names and their values', () => {
    expect(marks(highlight('<a href="/x" download>text</a>', 'html'))).toEqual([
      'tag:a',
      'attribute:href',
      'string:"/x"',
      'attribute:download',
      'tag:a',
    ]);
  });

  it('marks unquoted values, comments, doctypes and entities', () => {
    expect(
      marks(
        highlight('<!DOCTYPE html>\n<!-- hi -->\n<p id=one>&amp;</p>', 'html'),
      ),
    ).toEqual([
      'keyword:DOCTYPE html',
      'comment:<!-- hi -->',
      'tag:p',
      'attribute:id',
      'string:one',
      'constant:&amp;',
      'tag:p',
    ]);
  });

  it('reads script and style content as the language it is', () => {
    expect(
      marks(
        highlight(
          '<style>a { color: red }</style><script>const n = 1;</script>',
          'html',
        ),
      ),
    ).toEqual([
      'tag:style',
      'tag:a',
      'attribute:color',
      'constant:red',
      'tag:style',
      'tag:script',
      'keyword:const',
      'constant:1',
      'tag:script',
    ]);
  });

  it('leaves a lone angle bracket alone', () => {
    expect(marks(highlight('1 < 2 > 0', 'html'))).toEqual([]);
  });
});

describe('every highlighter', () => {
  const LANGUAGES = ['html', 'css', 'js'] as const;

  const SAMPLES = [
    '',
    '<',
    '<!--',
    '</',
    '<a href="',
    '`${',
    '"',
    "'",
    '/*',
    '/re',
    '@media',
    '{',
    '}',
    '&#',
    '<script>',
    '0x',
    '...',
  ];

  it.each(LANGUAGES)('puts %s back together again', language => {
    for (const sample of SAMPLES) {
      expect(source(highlight(sample, language))).toBe(sample);
    }
  });

  /** The parser is fuzzed the same way, for the same reason. */
  it.each(LANGUAGES)('terminates on random %s-ish input', language => {
    const alphabet = '<>/{}()[]"\'`$@#&;:=-.!*\n abc01\\';
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let round = 0; round < 400; round += 1) {
      let text = '';
      for (let index = 0; index < 120; index += 1) {
        text += alphabet[Math.floor(random() * alphabet.length)];
      }
      expect(source(highlight(text, language))).toBe(text);
    }
  });
});
