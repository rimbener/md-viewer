/**
 * Hiding and showing the file tree, and remembering the choice.
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
  fs.readFile.mockResolvedValue('# Notes');
  picker.mockResolvedValue([]);
  await storage.setItem('mdviewer.lastFolder', '/notes');
});

/** Renders the app with the stored folder open and every promise settled. */
async function renderApp(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
  return tree!;
}

/**
 * The toggle, whichever state it is currently in. The label repeats down the
 * Pressable's own render tree, so the outermost pressable node is the one.
 */
function toggleOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const found = tree.root.findAll(
    node =>
      (node.props.accessibilityLabel === 'Hide sidebar' ||
        node.props.accessibilityLabel === 'Show sidebar') &&
      typeof node.props.onPress === 'function',
  );
  expect(found.length).toBeGreaterThan(0);
  return found[0];
}

async function press(
  node: ReactTestRenderer.ReactTestInstance,
): Promise<void> {
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
}

/** The tree is present exactly when the folder path is on screen. */
function showsTree(tree: ReactTestRenderer.ReactTestRenderer): boolean {
  return tree.root.findAll(node => node.props.children === '/notes').length > 0;
}

it('hides the tree and brings it back', async () => {
  const tree = await renderApp();
  expect(showsTree(tree)).toBe(true);
  expect(toggleOf(tree).props.accessibilityLabel).toBe('Hide sidebar');

  await press(toggleOf(tree));

  expect(showsTree(tree)).toBe(false);
  // The control has to survive the panel it hides, or there is no way back.
  expect(toggleOf(tree).props.accessibilityLabel).toBe('Show sidebar');

  await press(toggleOf(tree));

  expect(showsTree(tree)).toBe(true);
});

it('remembers that the tree was hidden', async () => {
  await press(toggleOf(await renderApp()));

  await expect(storage.getItem('mdviewer.sidebarVisible')).resolves.toBe(
    'false',
  );
});

it('opens with the tree hidden when that is what was stored', async () => {
  await storage.setItem('mdviewer.sidebarVisible', 'false');

  const tree = await renderApp();

  expect(showsTree(tree)).toBe(false);
  expect(toggleOf(tree).props.accessibilityLabel).toBe('Show sidebar');
});
