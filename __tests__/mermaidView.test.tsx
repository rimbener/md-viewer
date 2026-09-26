import React from 'react';
import { ScrollView } from 'react-native';
import { writeFile } from '@dr.pogodin/react-native-fs';
import ReactTestRenderer from 'react-test-renderer';
import WebView from 'react-native-webview';

import { Markdown } from '../src/components/Markdown';
import { parseMarkdown } from '../src/markdown/parseBlocks';

const DIAGRAM = '```mermaid\ngraph TD\n  A-->B\n```';

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  for (const tree of trees.splice(0)) {
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  }
});

async function render(
  source: string,
): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <Markdown blocks={parseMarkdown(source)} basePath="/notes" />,
    );
  });
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
  trees.push(tree!);
  return tree!;
}

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

describe('a mermaid fence', () => {
  it('mounts a web view whose page holds the diagram', async () => {
    const tree = await render(DIAGRAM);
    const view = tree.root.findByType(WebView);
    const html = (writeFile as jest.Mock).mock.calls.at(-1)[1] as string;

    expect(view.props.source.uri).toContain('/md-viewer-mermaid/');
    expect(view.props.allowingReadAccessToURL).toContain('/md-viewer-mermaid/');
    expect(
      view.props.onShouldStartLoadWithRequest({
        url: view.props.source.uri.replace('file://', 'file://localhost'),
      }),
    ).toBe(true);
    expect(
      view.props.onShouldStartLoadWithRequest({ url: 'https://example.com' }),
    ).toBe(false);
    expect(html).toContain('graph TD');
    expect(html).toContain('"securityLevel":"strict"');
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
  });

  it('shows the fence as source when the page reports failure', async () => {
    const tree = await render(DIAGRAM);
    const view = tree.root.findByType(WebView);

    await ReactTestRenderer.act(async () => {
      view.props.onMessage({
        nativeEvent: { data: JSON.stringify({ ok: false }) },
      });
    });

    expect(tree.root.findAllByType(WebView)).toHaveLength(0);
    expect(strings(tree).join('')).toContain('A-->B');
  });

  it('switches between the diagram and the fence text', async () => {
    const tree = await render(DIAGRAM);
    const showText = tree.root.findByProps({
      accessibilityLabel: 'View Text',
    });

    await ReactTestRenderer.act(async () => {
      showText.props.onPress();
    });

    expect(tree.root.findAllByType(WebView)).toHaveLength(0);
    expect(strings(tree).join('')).toContain('A-->B');

    const showDiagram = tree.root.findByProps({
      accessibilityLabel: 'View Diagram',
    });
    await ReactTestRenderer.act(async () => {
      showDiagram.props.onPress();
    });
    for (let pass = 0; pass < 6; pass += 1) {
      await ReactTestRenderer.act(async () => {});
    }

    expect(tree.root.findAllByType(WebView)).toHaveLength(1);
  });

  it('leaves a fence in another language as plain code', async () => {
    const tree = await render('```python\nx = 1\n```');

    expect(tree.root.findAllByType(WebView)).toHaveLength(0);
    expect(strings(tree)).toEqual(['x = 1']);
  });
});
