/**
 * Rescanning the open folder so markdown files added since the last walk
 * appear in the tree.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { pickDirectory } from 'react-native-document-picker-macos';

import App from '../App';

const fs = { readDir, readFile } as unknown as {
  readDir: jest.Mock;
  readFile: jest.Mock;
};
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const picker = pickDirectory as jest.Mock;

function file(name: string) {
  return {
    name,
    path: `/notes/${name}`,
    isFile: () => true,
    isDirectory: () => false,
  };
}

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  fs.readDir.mockResolvedValue([file('notes.md')]);
  fs.readFile.mockResolvedValue('# Notes');
  picker.mockResolvedValue([]);
  await storage.setItem('mdviewer.lastFolder', '/notes');
});

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  for (const tree of trees.splice(0)) {
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  }
});

async function flush(): Promise<void> {
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
}

async function renderApp(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await flush();
  trees.push(tree!);
  return tree!;
}

type Rendered = ReactTestRenderer.ReactTestRendererJSON;

function collectText(node: Rendered | string | null): string[] {
  if (node === null) {
    return [];
  }
  if (typeof node === 'string') {
    return [node];
  }
  return (node.children ?? []).flatMap(collectText);
}

function textOf(tree: ReactTestRenderer.ReactTestRenderer): string {
  const root = tree.toJSON();
  const roots = Array.isArray(root) ? root : [root];
  return roots.flatMap(collectText).join('\n');
}

function reloadOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const found = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Reload folder' &&
      typeof node.props.onPress === 'function',
  );
  expect(found.length).toBeGreaterThan(0);
  return found[0];
}

async function press(node: ReactTestRenderer.ReactTestInstance): Promise<void> {
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
  await flush();
}

it('shows markdown files added since the folder was opened', async () => {
  const tree = await renderApp();
  expect(textOf(tree)).not.toContain('new.md');

  fs.readDir.mockResolvedValue([file('notes.md'), file('new.md')]);
  await press(reloadOf(tree));

  expect(textOf(tree)).toContain('new.md');
});

it('keeps the selected file after a reload', async () => {
  await storage.setItem('mdviewer.lastFile', '/notes/notes.md');

  const tree = await renderApp();
  fs.readDir.mockResolvedValue([file('notes.md'), file('new.md')]);
  await press(reloadOf(tree));

  expect(textOf(tree)).toContain('/notes/notes.md');
  expect(textOf(tree)).toContain('Notes');
});

it('clears the selection when the selected file is gone', async () => {
  await storage.setItem('mdviewer.lastFile', '/notes/notes.md');

  const tree = await renderApp();
  fs.readDir.mockResolvedValue([file('other.md')]);
  await press(reloadOf(tree));

  expect(textOf(tree)).toContain('other.md');
  expect(textOf(tree)).toContain('Select a markdown file from the sidebar.');
});

it('does not offer Reload before a folder is open', async () => {
  await storage.clear();

  const tree = await renderApp();

  expect(
    tree.root.findAll(node => node.props.accessibilityLabel === 'Reload folder')
      .length,
  ).toBe(0);
});
