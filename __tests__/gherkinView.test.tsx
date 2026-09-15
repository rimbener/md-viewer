import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { Markdown } from '../src/components/Markdown';
import { parseMarkdown } from '../src/markdown/parseBlocks';
import { FONT_SCHEMES } from '../src/typography';

const FEATURE = [
  '```gherkin',
  'Feature: ProgressStepper',
  '',
  '  @AC-1',
  '  Scenario Outline: Step appearance',
  '    Given a step of kind <kind>',
  '    Then it shows the translation of "button.continue"',
  '',
  '    Examples:',
  '      | kind     | appearance |',
  '      | video    | circle     |',
  '      | activity | bar        |',
  '```',
].join('\n');

function render(source: string, scale = 1, schemeId: string | null = null) {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <Markdown
        blocks={parseMarkdown(source)}
        basePath="/notes"
        scale={scale}
        schemeId={schemeId}
      />,
    );
  });
  return tree!;
}

/** Every string rendered anywhere in the tree, in order. */
function strings(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node !== null && typeof node === 'object') {
      walk((node as { children?: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out;
}

/** The first `Text` whose own content is, or ends with, `content`. */
function textFor(tree: ReactTestRenderer.ReactTestRenderer, content: string) {
  const own = (children: unknown) =>
    Array.isArray(children) ? children[children.length - 1] : children;
  const match = tree.root
    .findAllByType(Text)
    .find(node => own(node.props.children) === content);
  if (match === undefined) {
    throw new Error(`no Text rendering ${JSON.stringify(content)}`);
  }
  return StyleSheet.flatten(match.props.style);
}

describe('a gherkin fence', () => {
  it('renders as a feature rather than as a code block', () => {
    const tree = render(FEATURE);

    // A code block would put its text inside a horizontal ScrollView.
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(strings(tree)).toEqual(
      expect.arrayContaining([
        'FEATURE',
        'ProgressStepper',
        '@AC-1',
        'Step appearance',
        'Given',
        'Then',
      ]),
    );
  });

  it('leaves the fence to the code block renderer for other languages', () => {
    const tree = render('```ts\nconst a = 1;\n```');

    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    // The code block tints its tokens, so the source arrives in pieces.
    expect(strings(tree).join('')).toBe('const a = 1;');
  });

  it('sets step keywords apart from the step text', () => {
    const tree = render(FEATURE);

    expect(textFor(tree, 'Given').color).toBe(textFor(tree, 'Then').color);
    expect(textFor(tree, 'Given').color).not.toBe(
      textFor(tree, 'ProgressStepper').color,
    );
    expect(textFor(tree, 'Given').textAlign).toBe('right');
  });

  it('sets step keywords in the code font in every scheme', () => {
    for (const scheme of FONT_SCHEMES) {
      const tree = render(FEATURE, 1, scheme.id);
      const keyword = textFor(tree, 'Given');

      expect(keyword.fontFamily).toBe(textFor(tree, '<kind>').fontFamily);
      expect(keyword.fontFamily).not.toBe(
        textFor(tree, 'Step appearance').fontFamily,
      );
      // The keyword still sits on the baseline of the step text beside it.
      expect(keyword.lineHeight).toBe(
        textFor(tree, 'Step appearance').lineHeight,
      );
    }
  });

  it('colours outline parameters and quoted strings differently', () => {
    const tree = render(FEATURE);
    const parameter = textFor(tree, '<kind>');
    const quoted = textFor(tree, '"button.continue"');

    expect(parameter.color).not.toBe(quoted.color);
    // Both stand in for a value, so both keep the code font.
    expect(parameter.fontFamily).toBe(quoted.fontFamily);
    expect(parameter.fontFamily).not.toBe(
      textFor(tree, 'Step appearance').fontFamily,
    );
  });

  it('lays an Examples block out as a table', () => {
    const tree = render(FEATURE);

    expect(strings(tree)).toEqual(
      expect.arrayContaining([
        'EXAMPLES',
        'kind',
        'appearance',
        'video',
        'circle',
        'activity',
        'bar',
      ]),
    );
  });

  it('scales with the document zoom', () => {
    // The scheme is pinned to the unscaled one so this measures zoom alone.
    const small = textFor(render(FEATURE, 1, 'native'), 'Given').fontSize;
    const large = textFor(render(FEATURE, 2, 'native'), 'Given').fontSize;

    expect(large).toBe(small * 2);
  });
});
