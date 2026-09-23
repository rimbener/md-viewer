/**
 * Finding text in the open document.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useRef, type RefObject } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { pickDirectory } from 'react-native-document-picker-macos';

import App from '../App';
import { FindProvider } from '../src/find';
import { Markdown } from '../src/components/Markdown';
import { parseMarkdown } from '../src/markdown/parseBlocks';

const fs = { readDir, readFile } as unknown as {
  readDir: jest.Mock;
  readFile: jest.Mock;
};
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const picker = pickDirectory as jest.Mock;

const SOURCE = ['# Title', '', 'alpha is here', '', 'and alpha again'].join(
  '\n',
);

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  fs.readDir.mockResolvedValue([
    {
      name: 'notes.md',
      path: '/notes/notes.md',
      isFile: () => true,
      isDirectory: () => false,
    },
  ]);
  fs.readFile.mockResolvedValue(SOURCE);
  picker.mockResolvedValue([]);
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFile', '/notes/notes.md');
});

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  for (const tree of trees.splice(0)) {
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  }
});

async function renderApp(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
  trees.push(tree!);
  return tree!;
}

function findField(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findByProps({ accessibilityLabel: 'Find in document' });
}

async function typeFind(
  tree: ReactTestRenderer.ReactTestRenderer,
  query: string,
): Promise<void> {
  await ReactTestRenderer.act(async () => {
    findField(tree).props.onChangeText(query);
  });
}

function hitBackgrounds(
  tree: ReactTestRenderer.ReactTestRenderer,
  content: string,
): string[] {
  return tree.root
    .findAllByType(Text)
    .filter(node => node.props.children === content)
    .map(
      node => StyleSheet.flatten(node.props.style)?.backgroundColor as string,
    );
}

it('places the field last in the header', async () => {
  const tree = await renderApp();
  const labels = tree.root
    .findAll(node => typeof node.props.accessibilityLabel === 'string')
    .map(node => node.props.accessibilityLabel as string);
  const zoom = labels.findIndex(label => label === 'Zoom in');
  const find = labels.findIndex(label => label === 'Find in document');

  expect(zoom).toBeGreaterThanOrEqual(0);
  expect(zoom).toBeLessThan(find);
  expect(findField(tree).type).toBe(TextInput);
});

it('marks hits and moves the current one', async () => {
  const tree = await renderApp();

  await typeFind(tree, 'alpha');

  expect(
    tree.root.findByProps({ accessibilityLabel: 'Match 1 of 2' }),
  ).toBeTruthy();
  expect(hitBackgrounds(tree, 'alpha')).toEqual(['#f5a524', '#ffe08a']);

  await ReactTestRenderer.act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Next match' }).props.onPress();
  });

  expect(
    tree.root.findByProps({ accessibilityLabel: 'Match 2 of 2' }),
  ).toBeTruthy();
  expect(hitBackgrounds(tree, 'alpha')).toEqual(['#ffe08a', '#f5a524']);
});

it('matches without regard to letter case', async () => {
  const tree = await renderApp();

  await typeFind(tree, 'ALPHA');

  expect(
    tree.root.findByProps({ accessibilityLabel: 'Match 1 of 2' }),
  ).toBeTruthy();
  expect(hitBackgrounds(tree, 'alpha')).toHaveLength(2);
});

it('clears the marks', async () => {
  const tree = await renderApp();
  await typeFind(tree, 'alpha');

  await ReactTestRenderer.act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Clear find' }).props.onPress();
  });

  expect(hitBackgrounds(tree, 'alpha')).toEqual([]);
  expect(findField(tree).props.value).toBe('');
});

function Probe({
  source,
  query,
  onCount,
}: {
  source: string;
  query: string;
  onCount: (count: number) => void;
}) {
  const contentRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  return (
    <FindProvider
      query={query}
      active={0}
      contentRef={contentRef as RefObject<View | null>}
      scrollRef={scrollRef as RefObject<ScrollView | null>}
      onCount={onCount}
    >
      <View ref={contentRef}>
        <Markdown blocks={parseMarkdown(source)} basePath="/notes" />
      </View>
    </FindProvider>
  );
}

async function countFor(source: string, query: string): Promise<number> {
  let count = -1;
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <Probe
        source={source}
        query={query}
        onCount={next => {
          count = next;
        }}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    tree!.unmount();
  });
  return count;
}

it('does not join a hit across bold and plain text', async () => {
  expect(await countFor('**al**pha', 'alpha')).toBe(0);
});

it('marks text inside a code fence', async () => {
  expect(await countFor('```\nalpha\n```', 'alpha')).toBe(1);
});

it('marks text inside a gherkin step', async () => {
  expect(
    await countFor('```gherkin\nFeature: Cart\n  Given alpha\n```', 'alpha'),
  ).toBe(1);
});
