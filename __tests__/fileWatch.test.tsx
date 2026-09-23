/**
 * Rereading the open file when it changes on disk.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { pickDirectory } from 'react-native-document-picker-macos';

import { watchFile } from '../src/folderAccess';
import App from '../App';

jest.mock('../src/folderAccess', () => {
  const actual = jest.requireActual(
    '../src/folderAccess',
  ) as typeof import('../src/folderAccess');
  return {
    ...actual,
    watchFile: jest.fn(() => () => {}),
  };
});

const fs = { readDir, readFile } as unknown as {
  readDir: jest.Mock;
  readFile: jest.Mock;
};
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const picker = pickDirectory as jest.Mock;
const watch = watchFile as jest.MockedFunction<typeof watchFile>;

let notify: (() => void) | null;

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  notify = null;
  watch.mockImplementation((_path, onChange) => {
    notify = onChange;
    return () => {
      if (notify === onChange) {
        notify = null;
      }
    };
  });
  fs.readDir.mockResolvedValue([
    {
      name: 'notes.md',
      path: '/notes/notes.md',
      isFile: () => true,
      isDirectory: () => false,
    },
    {
      name: 'other.md',
      path: '/notes/other.md',
      isFile: () => true,
      isDirectory: () => false,
    },
  ]);
  fs.readFile.mockImplementation(async (path: string) =>
    path === '/notes/other.md' ? '# Other' : '# Notes',
  );
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

function toggleOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const found = tree.root.findAll(
    node =>
      (node.props.accessibilityLabel === 'Hide editor' ||
        node.props.accessibilityLabel === 'Show editor') &&
      typeof node.props.onPress === 'function',
  );
  expect(found.length).toBeGreaterThan(0);
  return found[0];
}

function editorOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const [input] = tree.root.findAll(
    node =>
      node.type === TextInput &&
      node.props.accessibilityLabel === 'Markdown source',
  );
  return input;
}

function renderedText(tree: ReactTestRenderer.ReactTestRenderer): string {
  const runs: string[] = [];

  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      runs.push(node);
      return;
    }
    if (node === null || typeof node !== 'object') {
      return;
    }
    const { children } = node as { children?: unknown[] };
    if (Array.isArray(children)) {
      children.forEach(walk);
    }
  };

  walk(tree.toJSON());
  return runs.join('\u0000');
}

function shows(
  tree: ReactTestRenderer.ReactTestRenderer,
  text: string,
): boolean {
  return renderedText(tree).includes(text);
}

async function press(node: ReactTestRenderer.ReactTestInstance): Promise<void> {
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
}

async function type(
  tree: ReactTestRenderer.ReactTestRenderer,
  source: string,
): Promise<void> {
  await ReactTestRenderer.act(async () => {
    editorOf(tree).props.onChangeText(source);
  });
}

async function settle(): Promise<void> {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 200));
  });
}

async function fireWatch(): Promise<void> {
  await ReactTestRenderer.act(async () => {
    notify?.();
    await new Promise<void>(resolve => setTimeout(resolve, 200));
  });
}

it('rerenders the open file when it changes on disk', async () => {
  const tree = await renderApp();
  expect(shows(tree, 'Notes')).toBe(true);

  fs.readFile.mockImplementation(async (path: string) =>
    path === '/notes/other.md' ? '# Other' : '# Reloaded',
  );
  await fireWatch();

  expect(shows(tree, 'Reloaded')).toBe(true);
  expect(shows(tree, 'Notes')).toBe(false);
});

it('keeps a draft and says so when disk changes under it', async () => {
  const tree = await renderApp();
  await press(toggleOf(tree));
  await type(tree, '# Changed');
  await settle();

  fs.readFile.mockImplementation(async () => '# Reloaded');
  await fireWatch();

  expect(editorOf(tree).props.value).toBe('# Changed');
  expect(shows(tree, 'Changed')).toBe(true);
  expect(shows(tree, 'Reloaded')).toBe(false);
  expect(
    shows(tree, '/notes/notes.md — edited, not saved — file changed on disk'),
  ).toBe(true);
});
