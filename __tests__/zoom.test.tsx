import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { Markdown } from '../src/components/Markdown';
import { parseMarkdown } from '../src/markdown/parseBlocks';
import { DEFAULT_ZOOM, ZOOM_LEVELS, stepZoom } from '../src/zoom';

/**
 * Font size of the first `Text` rendered for `source` at a given zoom. The
 * scheme is pinned to the unscaled one so this measures zoom alone.
 */
function fontSizeAt(source: string, scale: number): number {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <Markdown
        blocks={parseMarkdown(source)}
        basePath="/notes"
        scale={scale}
        schemeId="native"
      />,
    );
  });
  const [first] = tree!.root.findAllByType(Text);
  return StyleSheet.flatten(first.props.style).fontSize;
}

describe('stepZoom', () => {
  it('moves one step at a time', () => {
    expect(stepZoom(DEFAULT_ZOOM, 1)).toBe(1.15);
    expect(stepZoom(DEFAULT_ZOOM, -1)).toBe(0.9);
  });

  it('stops at both ends instead of wrapping', () => {
    const smallest = ZOOM_LEVELS[0];
    const largest = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    expect(stepZoom(smallest, -1)).toBe(smallest);
    expect(stepZoom(largest, 1)).toBe(largest);
  });

  it('falls back to the default for an unknown scale', () => {
    expect(stepZoom(1.07, 1)).toBe(1.15);
  });
});

describe('Markdown zoom', () => {
  it('scales headings and body text together', () => {
    expect(fontSizeAt('# Title', 1)).toBe(26);
    expect(fontSizeAt('# Title', 2)).toBe(52);
    expect(fontSizeAt('body text', 1)).toBe(14);
    expect(fontSizeAt('body text', 1.5)).toBe(21);
  });
});
