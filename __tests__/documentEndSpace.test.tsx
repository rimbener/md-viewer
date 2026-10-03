/**
 * Blank space after the last line. Full scroll leaves that line 300 px
 * below the top of the view.
 */

import { readFile } from '@dr.pogodin/react-native-fs';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { DocumentPanel } from '../src/components/DocumentPanel';
import type { FileNode } from '../src/types';

const fs = { readFile } as unknown as { readFile: jest.Mock };

const file: FileNode = {
  kind: 'file',
  name: 'notes.md',
  path: '/notes/notes.md',
};

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  fs.readFile.mockResolvedValue('Last line of the note.');
});

afterEach(async () => {
  for (const tree of trees.splice(0)) {
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  }
});

async function renderPanel(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DocumentPanel
        file={file}
        isSidebarVisible
        onToggleSidebar={() => {}}
        canGoBack={false}
        canGoNext={false}
        onBack={() => {}}
        onNext={() => {}}
      />,
    );
  });
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
  trees.push(tree!);
  return tree!;
}

function scrollerOf(
  tree: ReactTestRenderer.ReactTestRenderer,
): ReactTestRenderer.ReactTestInstance {
  return tree.root.findByType(ScrollView);
}

function layout(
  tree: ReactTestRenderer.ReactTestRenderer,
  height: number,
): void {
  ReactTestRenderer.act(() => {
    scrollerOf(tree).props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 480, height } },
    });
  });
}

/** The line height of the last text in the document. */
function lastLineHeight(scroller: ReactTestRenderer.ReactTestInstance): number {
  const texts = scroller.findAllByType(Text);
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const lineHeight = StyleSheet.flatten(texts[index].props.style)?.lineHeight;
    if (typeof lineHeight === 'number') {
      return lineHeight;
    }
  }
  throw new Error('The document has no line.');
}

/** Padding already under the text, which the end space must not count twice. */
function contentPadding(scroller: ReactTestRenderer.ReactTestInstance): number {
  for (const view of scroller.findAll(
    node => typeof node.props.style !== 'undefined',
  )) {
    const paddingBottom = StyleSheet.flatten(view.props.style)?.paddingBottom;
    if (typeof paddingBottom === 'number' && paddingBottom > 0) {
      return paddingBottom;
    }
  }
  throw new Error('The document has no bottom padding.');
}

/** Full scroll leaves the last line this far below the top of the view. */
const LAST_LINE_INSET = 300;

function endSpace(scroller: ReactTestRenderer.ReactTestInstance): number {
  return scroller.props.contentContainerStyle.paddingBottom;
}

function expectedSpace(
  viewHeight: number,
  scroller: ReactTestRenderer.ReactTestInstance,
): number {
  return (
    viewHeight -
    lastLineHeight(scroller) -
    contentPadding(scroller) -
    LAST_LINE_INSET
  );
}

it('leaves the last line 300 px below the top of the view', async () => {
  const tree = await renderPanel();
  const viewHeight = 640;

  layout(tree, viewHeight);

  const scroller = scrollerOf(tree);
  expect(endSpace(scroller)).toBe(expectedSpace(viewHeight, scroller));
});

it('keeps that space when the view changes height', async () => {
  const tree = await renderPanel();

  layout(tree, 640);
  layout(tree, 800);

  const scroller = scrollerOf(tree);
  expect(endSpace(scroller)).toBe(expectedSpace(800, scroller));
});

it('shrinks the space when the line grows', async () => {
  const tree = await renderPanel();
  layout(tree, 640);

  const zoomIn = tree.root.findByProps({ accessibilityLabel: 'Zoom in' });
  await ReactTestRenderer.act(async () => {
    zoomIn.props.onPress();
  });

  const scroller = scrollerOf(tree);
  expect(endSpace(scroller)).toBe(expectedSpace(640, scroller));
  expect(endSpace(scroller)).toBeGreaterThan(0);
});
