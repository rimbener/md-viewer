import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { Markdown } from '../src/components/Markdown';
import { parseMarkdown } from '../src/markdown/parseBlocks';
import {
  columnWidth,
  DEFAULT_SCHEME_ID,
  FONT_SCHEMES,
  isSchemeId,
  nextSchemeId,
  schemeById,
} from '../src/typography';

/** Flattened style of the first `Text` rendered for `source`. */
function styleOf(source: string, schemeId: string | null) {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <Markdown
        blocks={parseMarkdown(source)}
        basePath="/notes"
        schemeId={schemeId}
      />,
    );
  });
  const [first] = tree!.root.findAllByType(Text);
  return StyleSheet.flatten(first.props.style);
}

describe('font schemes', () => {
  it('cycles through every scheme and wraps', () => {
    const seen = new Set<string>();
    let id = DEFAULT_SCHEME_ID;
    for (let step = 0; step < FONT_SCHEMES.length; step += 1) {
      seen.add(id);
      id = nextSchemeId(id);
    }
    expect(seen.size).toBe(FONT_SCHEMES.length);
    expect(id).toBe(DEFAULT_SCHEME_ID);
  });

  it('falls back to the default for an unknown id', () => {
    expect(schemeById('nonsense').id).toBe(DEFAULT_SCHEME_ID);
    expect(schemeById(null).id).toBe(DEFAULT_SCHEME_ID);
    expect(isSchemeId('nonsense')).toBe(false);
    expect(isSchemeId('editorial')).toBe(true);
  });

  it('every scheme names fonts that ship with macOS', () => {
    // Guards against a typo silently falling back to the system font.
    const available = new Set([
      'Charter',
      'Seravek',
      'Avenir Next',
      'Iowan Old Style',
      'Menlo',
    ]);
    for (const scheme of FONT_SCHEMES) {
      for (const role of [scheme.heading, scheme.body, scheme.code]) {
        if (role.family !== undefined) {
          expect(available).toContain(role.family);
        }
        expect(role.scale).toBeGreaterThan(0.8);
        expect(role.scale).toBeLessThan(1.2);
      }
    }
  });
});

describe('scheme rendering', () => {
  it('applies the body font to paragraphs', () => {
    expect(styleOf('body text', 'editorial').fontFamily).toBe('Charter');
    expect(styleOf('body text', 'humanist').fontFamily).toBe('Seravek');
    // The system font is the absence of a family, not a name.
    expect(styleOf('body text', 'native').fontFamily).toBeUndefined();
  });

  it('applies the heading font independently of the body', () => {
    expect(styleOf('# Title', 'editorial').fontFamily).toBeUndefined();
    expect(styleOf('# Title', 'humanist').fontFamily).toBe('Avenir Next');
  });

  it('keeps code monospaced in every scheme', () => {
    for (const scheme of FONT_SCHEMES) {
      expect(styleOf('    indented code', scheme.id).fontFamily).toBe('Menlo');
    }
  });

  it('compensates size so schemes look equally large', () => {
    const native = styleOf('body text', 'native').fontSize;
    const editorial = styleOf('body text', 'editorial').fontSize;
    // Charter's smaller x-height per em is corrected by a larger point size.
    expect(editorial).toBeGreaterThan(native);
    expect(editorial).toBeLessThan(native * 1.1);
  });
});

describe('columnWidth', () => {
  it('gives every scheme the same line length in characters', () => {
    const widths = FONT_SCHEMES.map(scheme => {
      const bodySize = 14 * scheme.body.scale;
      return columnWidth(scheme, 1) / (scheme.body.advance * bodySize);
    });
    // Each is the same target character count, give or take pixel rounding.
    for (const characters of widths) {
      expect(characters).toBeCloseTo(widths[0], 0);
    }
    expect(widths[0]).toBeGreaterThan(60);
    expect(widths[0]).toBeLessThan(90);
  });

  it('grows with zoom so the line length does not shrink', () => {
    const scheme = schemeById(DEFAULT_SCHEME_ID);
    const doubled = columnWidth(scheme, 1) * 2;
    expect(columnWidth(scheme, 2)).toBeGreaterThan(doubled - 2);
    expect(columnWidth(scheme, 2)).toBeLessThan(doubled + 2);
  });

  it('lands in a sensible pixel range at natural size', () => {
    for (const scheme of FONT_SCHEMES) {
      const width = columnWidth(scheme, 1);
      expect(width).toBeGreaterThan(400);
      expect(width).toBeLessThan(600);
    }
  });
});
