/**
 * Back and Next through the files opened in the current folder, and the list
 * that remembers them for that folder.
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

/** Maps a directory path to the names it contains. */
type FakeFs = Record<string, string[]>;

function mockFs(listing: FakeFs) {
  fs.readDir.mockImplementation(async (path: string) => {
    const entries = listing[path];
    if (!entries) {
      throw new Error(`ENOENT: ${path}`);
    }
    return entries.map(name => ({
      name,
      path: `${path}/${name}`,
      isFile: () => true,
      isDirectory: () => false,
    }));
  });
}

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  mockFs({
    '/notes': ['a.md', 'b.md', 'c.md'],
    '/docs': ['d.md', 'e.md'],
  });
  fs.readFile.mockImplementation(async (path: string) => `# ${path}`);
  picker.mockResolvedValue([]);
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFile', '/notes/a.md');
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
  for (let pass = 0; pass < 8; pass += 1) {
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

function button(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const found = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
  expect(found.length).toBeGreaterThan(0);
  return found[0];
}

function labeled(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const text = tree.root.findAll(node => node.props.children === label)[0];
  let current: ReactTestRenderer.ReactTestInstance | null = text ?? null;
  while (current !== null && typeof current.props.onPress !== 'function') {
    current = current.parent;
  }
  expect(current).not.toBeNull();
  return current!;
}

async function press(node: ReactTestRenderer.ReactTestInstance): Promise<void> {
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
  await flush();
}

async function openFile(
  tree: ReactTestRenderer.ReactTestRenderer,
  name: string,
): Promise<void> {
  await press(button(tree, name));
}

it('moves back and next through files opened in this folder', async () => {
  const tree = await renderApp();
  expect(button(tree, 'Back').props.disabled).toBe(true);
  expect(button(tree, 'Next').props.disabled).toBe(true);

  await openFile(tree, 'b.md');
  expect(textOf(tree)).toContain('/notes/b.md');
  expect(button(tree, 'Back').props.disabled).toBe(false);

  await press(button(tree, 'Back'));
  expect(textOf(tree)).toContain('/notes/a.md');
  expect(button(tree, 'Next').props.disabled).toBe(false);

  await press(button(tree, 'Next'));
  expect(textOf(tree)).toContain('/notes/b.md');
});

it('drops the forward files when a different file is opened after Back', async () => {
  const tree = await renderApp();
  await openFile(tree, 'b.md');
  await press(button(tree, 'Back'));
  await openFile(tree, 'c.md');

  expect(button(tree, 'Next').props.disabled).toBe(true);
  await press(button(tree, 'Back'));
  expect(textOf(tree)).toContain('/notes/a.md');
});

it('restores the list for this folder on the next launch', async () => {
  const tree = await renderApp();
  await openFile(tree, 'b.md');
  await press(button(tree, 'Back'));
  await ReactTestRenderer.act(async () => {
    tree.unmount();
  });
  trees.pop();

  const again = await renderApp();
  expect(textOf(again)).toContain('/notes/a.md');
  await press(button(again, 'Next'));
  expect(textOf(again)).toContain('/notes/b.md');
});

it('keeps a separate list for each folder', async () => {
  const tree = await renderApp();
  await openFile(tree, 'b.md');

  picker.mockResolvedValueOnce([{ path: '/docs' }]);
  await press(labeled(tree, 'Change Folder…'));
  await openFile(tree, 'd.md');
  await openFile(tree, 'e.md');
  await press(button(tree, 'Back'));
  expect(textOf(tree)).toContain('/docs/d.md');

  picker.mockResolvedValueOnce([{ path: '/notes' }]);
  await press(labeled(tree, 'Change Folder…'));
  expect(textOf(tree)).toContain('/notes/b.md');
  await press(button(tree, 'Back'));
  expect(textOf(tree)).toContain('/notes/a.md');
  expect(textOf(tree)).not.toContain('/docs/d.md');
});
