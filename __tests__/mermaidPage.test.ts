import {
  MERMAID_TEXT_CAP,
  isMermaid,
  mermaidPage,
  parseMermaidResult,
  type MermaidPageOptions,
} from '../src/mermaidPage';
import type { Theme } from '../src/theme';

const theme = {
  background: '#111111',
  sidebar: '#666666',
  border: '#444444',
  text: '#222222',
  mutedText: '#555555',
  selectedBackground: '#000000',
  selectedText: '#000000',
  hairline: '#000000',
  accent: '#777777',
  code: '#333333',
  inlineCode: '#000000',
  codeBorder: '#000000',
  link: '#000000',
  quoteBar: '#000000',
  tableHeader: '#000000',
  gherkinKeyword: '#000000',
  gherkinTag: '#000000',
  gherkinParameter: '#000000',
  gherkinString: '#000000',
  syntaxComment: '#000000',
  syntaxKeyword: '#000000',
  syntaxString: '#000000',
  syntaxConstant: '#000000',
  syntaxTag: '#000000',
  syntaxAttribute: '#000000',
  syntaxFunction: '#000000',
  searchHit: '#000000',
  searchCurrent: '#000000',
} satisfies Theme;

const options: MermaidPageOptions = {
  theme,
  scale: 2,
  bodyScale: 1,
};

function readConst(html: string, marker: string): unknown {
  const start = html.indexOf(marker);
  const end = html.indexOf(';\n', start);
  return JSON.parse(html.slice(start + marker.length, end));
}

describe('mermaidPage', () => {
  it('keeps a script-breaking fence inside the source string', () => {
    const text = 'graph TD\nA["</script><script>alert(1)</script>"]';
    const html = mermaidPage(text, options);

    expect(html).not.toBeNull();
    const literal = html!.slice(html!.indexOf('const source = '));
    expect(literal.slice(0, literal.indexOf(';\n'))).not.toContain('<');
    expect(readConst(html!, 'const source = ')).toBe(text);
  });

  it('locks the security keys and paints with the given palette', () => {
    const html = mermaidPage('graph TD\nA-->B', {
      ...options,
      fontFamily: 'Charter',
    });
    const config = readConst(html!, 'const config = ') as {
      background: string;
      init: {
        startOnLoad: boolean;
        securityLevel: string;
        suppressErrorRendering: boolean;
        maxTextSize: number;
        secure: string[];
        theme: string;
        fontFamily: string;
        fontSize: number;
        themeVariables: Record<string, string>;
      };
    };

    expect(config.init).toMatchObject({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      maxTextSize: MERMAID_TEXT_CAP,
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize'],
      theme: 'base',
      fontFamily: 'Charter',
      fontSize: 28,
    });
    expect(config.background).toBe('#111111');
    expect(config.init.themeVariables).toMatchObject({
      background: '#111111',
      primaryColor: '#333333',
      primaryTextColor: '#222222',
      primaryBorderColor: '#444444',
      lineColor: '#555555',
      secondaryColor: '#666666',
      textColor: '#222222',
      signalColor: '#777777',
    });
  });

  it('uses the system font when the scheme leaves the body face unset', () => {
    const html = mermaidPage('graph TD\nA-->B', options);
    const config = readConst(html!, 'const config = ') as {
      init: { fontFamily: string };
    };

    expect(config.init.fontFamily).toBe('-apple-system');
  });

  it('returns no page once the fence is over the cap', () => {
    expect(mermaidPage('x'.repeat(MERMAID_TEXT_CAP), options)).not.toBeNull();
    expect(mermaidPage('x'.repeat(MERMAID_TEXT_CAP + 1), options)).toBeNull();
  });
});

describe('isMermaid', () => {
  it('accepts the mermaid tag in any case', () => {
    expect(isMermaid('mermaid')).toBe(true);
    expect(isMermaid('Mermaid')).toBe(true);
    expect(isMermaid('mmd')).toBe(false);
    expect(isMermaid(null)).toBe(false);
  });
});

describe('parseMermaidResult', () => {
  it('keeps a positive height and rejects anything else', () => {
    expect(parseMermaidResult('{"ok":true,"height":40}')).toEqual({
      ok: true,
      height: 40,
    });
    expect(parseMermaidResult('{"ok":true,"height":0}')).toEqual({
      ok: false,
    });
    expect(parseMermaidResult('{"ok":false}')).toEqual({ ok: false });
    expect(parseMermaidResult('not json')).toEqual({ ok: false });
  });
});
