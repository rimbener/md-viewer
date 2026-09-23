/**
 * Clicking a folder in the sidebar walks that folder again, so files added
 * since the last walk — or sitting deeper than the three-level cap — appear.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';

const fs = { readDir, readFile } as unknown as {
  readDir: jest.Mock;
  readFile: jest.Mock;
};
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

/** Maps a directory path to the names it contains; names ending in `/` are directories. */
type FakeFs = Record<string, string[]>;

function mockFs(listing: FakeFs) {
  fs.readDir.mockImplementation(async (path: string) => {
    const entries = listing[path];
    if (!entries) {
      throw new Error(`ENOENT: ${path}`);
    }
    return entries.map(entry => {
      const isDirectory = entry.endsWith('/');
      const name = isDirectory ? entry.slice(0, -1) : entry;
      return {
        name,
        path: `${path}/${name}`,
        isFile: () => !isDirectory,
        isDirectory: () => isDirectory,
      };
    });
  });
}

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  fs.readFile.mockResolvedValue('# Notes');
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

function folderOf(tree: ReactTestRenderer.ReactTestRenderer, name: string) {
  const found = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === `${name} folder` &&
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

it('shows markdown files added since that folder was last walked', async () => {
  mockFs({
    '/notes': ['sub/', 'notes.md'],
    '/notes/sub': ['old.md'],
  });

  const tree = await renderApp();
  expect(textOf(tree)).not.toContain('new.md');

  mockFs({
    '/notes': ['sub/', 'notes.md'],
    '/notes/sub': ['old.md', 'new.md'],
  });
  await press(folderOf(tree, 'sub'));

  expect(textOf(tree)).toContain('new.md');
});

it('reads a folder past the three-level cap when that folder is clicked', async () => {
  mockFs({
    '/notes': ['a/'],
    '/notes/a': ['b/'],
    '/notes/a/b': ['c/'],
    '/notes/a/b/c': ['d/'],
    '/notes/a/b/c/d': ['buried.md'],
  });

  const tree = await renderApp();
  expect(textOf(tree)).not.toContain('buried.md');

  await press(folderOf(tree, 'a'));
  await press(folderOf(tree, 'b'));
  await press(folderOf(tree, 'c'));
  await press(folderOf(tree, 'd'));

  expect(textOf(tree)).toContain('buried.md');
});

it('reopens a stored file deeper than three levels', async () => {
  mockFs({
    '/notes': ['a/'],
    '/notes/a': ['b/'],
    '/notes/a/b': ['c/'],
    '/notes/a/b/c': ['d/'],
    '/notes/a/b/c/d': ['buried.md'],
  });
  await storage.setItem('mdviewer.lastFile', '/notes/a/b/c/d/buried.md');

  const tree = await renderApp();

  expect(textOf(tree)).toContain('buried.md');
  expect(textOf(tree)).toContain('Notes');
});
