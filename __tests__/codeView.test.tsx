import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { Markdown } from '../src/components/Markdown';
import { parseMarkdown } from '../src/markdown/parseBlocks';

function render(source: string) {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <Markdown blocks={parseMarkdown(source)} basePath="/notes" />,
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

/** The colour of the first `Text` whose own content is exactly `content`. */
function colorOf(
  tree: ReactTestRenderer.ReactTestRenderer,
  content: string,
): string | undefined {
  const match = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === content);
  if (match === undefined) {
    throw new Error(`no Text rendering ${JSON.stringify(content)}`);
  }
  return StyleSheet.flatten(match.props.style).color;
}

const FENCE = '```ts\nconst greeting = say("hi"); // wave\n```';

describe('a highlighted code block', () => {
  it('renders the source unchanged', () => {
    expect(strings(render(FENCE)).join('')).toBe(
      'const greeting = say("hi"); // wave',
    );
  });

  it('gives keywords, calls, strings and comments their own colours', () => {
    const tree = render(FENCE);
    const colors = ['const', 'say', '"hi"', '// wave'].map(token =>
      colorOf(tree, token),
    );

    expect(new Set(colors).size).toBe(colors.length);
  });

  it('leaves a fence in an unknown language as plain code', () => {
    const tree = render('```python\nx = 1\n```');

    expect(strings(tree)).toEqual(['x = 1']);
  });

  it('leaves a fence with no language as plain code', () => {
    const tree = render('```\nx = 1\n```');

    expect(strings(tree)).toEqual(['x = 1']);
  });
});

describe('a code span', () => {
  it('tints text inside backticks', () => {
    const tree = render('use `name` here');

    expect(colorOf(tree, 'name')).toBe('#d39039');
  });
});
