/**
 * Opening the source editor, and the rendered document following what is
 * typed into it.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { TextInput } from 'react-native';
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

// Waiting out a debounce takes real time, in which a tree left mounted by an
// earlier test would settle its own reads and update outside `act`.
afterEach(async () => {
  for (const tree of trees.splice(0)) {
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  }
});

/** Renders the app with the stored file open and every promise settled. */
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

/** The editor toggle, whichever state it is currently in. */
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

function hasEditor(tree: ReactTestRenderer.ReactTestRenderer): boolean {
  return (
    tree.root.findAll(
      node =>
        node.type === TextInput &&
        node.props.accessibilityLabel === 'Markdown source',
    ).length > 0
  );
}

/**
 * Every string the tree actually renders, joined. Walking the rendered JSON
 * rather than the instances is what reaches prose: the markdown renderer emits
 * plain runs as bare strings inside a fragment, so they are nobody's props.
 * Children only, so the editor's `value` prop cannot be mistaken for output.
 */
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

/** Whether `text` is rendered anywhere on screen. */
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

/** Types into the editor, without waiting for the preview to catch up. */
async function type(
  tree: ReactTestRenderer.ReactTestRenderer,
  source: string,
): Promise<void> {
  await ReactTestRenderer.act(async () => {
    editorOf(tree).props.onChangeText(source);
  });
}

/** Waits out the debounce, so the preview holds what was last typed. */
async function settle(): Promise<void> {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 200));
  });
}

/** Selects a file in the tree by its name. */
async function open(
  tree: ReactTestRenderer.ReactTestRenderer,
  name: string,
): Promise<void> {
  const [row] = tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.findAll(child => child.props.children === name).length > 0,
  );
  await ReactTestRenderer.act(async () => {
    row.props.onPress();
  });
  // The tree's FlatList rerenders its window on a 50ms batch, which has to
  // land inside `act` or React warns about the update that follows the test.
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 60));
  });
}

it('opens the editor beside the document and closes it again', async () => {
  const tree = await renderApp();
  expect(hasEditor(tree)).toBe(false);
  expect(toggleOf(tree).props.accessibilityLabel).toBe('Show editor');

  await press(toggleOf(tree));

  expect(hasEditor(tree)).toBe(true);
  expect(editorOf(tree).props.value).toBe('# Notes');
  // The document stays on screen: the editor is a second pane, not a mode.
  expect(shows(tree, 'Notes')).toBe(true);
  expect(toggleOf(tree).props.accessibilityLabel).toBe('Hide editor');

  await press(toggleOf(tree));

  expect(hasEditor(tree)).toBe(false);
});

it('rerenders the document as the source is typed', async () => {
  const tree = await renderApp();
  await press(toggleOf(tree));

  await type(tree, '# Changed');
  await settle();

  expect(shows(tree, 'Changed')).toBe(true);
  expect(shows(tree, 'Notes')).toBe(false);
});

it('holds the preview while the typing continues', async () => {
  const tree = await renderApp();
  await press(toggleOf(tree));

  await type(tree, '# Cha');
  await type(tree, '# Chang');
  await type(tree, '# Changed');

  // The editor takes every keystroke; the document waits for the pause.
  expect(editorOf(tree).props.value).toBe('# Changed');
  expect(shows(tree, 'Notes')).toBe(true);

  await settle();

  expect(shows(tree, 'Changed')).toBe(true);
  expect(shows(tree, 'Notes')).toBe(false);
});

it('remembers that the editor was open', async () => {
  await press(toggleOf(await renderApp()));

  await expect(storage.getItem('mdviewer.editorVisible')).resolves.toBe('true');
});

it('opens with the editor showing when that is what was stored', async () => {
  await storage.setItem('mdviewer.editorVisible', 'true');

  expect(hasEditor(await renderApp())).toBe(true);
});

it('keeps edits when another file is opened and comes back to them', async () => {
  const tree = await renderApp();
  await press(toggleOf(tree));
  await type(tree, '# Changed');
  await settle();

  await open(tree, 'other.md');
  expect(editorOf(tree).props.value).toBe('# Other');

  await open(tree, 'notes.md');
  expect(editorOf(tree).props.value).toBe('# Changed');
  expect(shows(tree, 'Changed')).toBe(true);
});

it('says so when the buffer no longer matches the file on disk', async () => {
  const tree = await renderApp();
  expect(shows(tree, '/notes/notes.md')).toBe(true);

  await press(toggleOf(tree));
  await type(tree, '# Changed');

  expect(shows(tree, '/notes/notes.md — edited, not saved')).toBe(true);
});
