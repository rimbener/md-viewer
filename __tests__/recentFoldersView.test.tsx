/**
 * The menu of folders opened before. It sits above Change Folder and opens
 * the chosen folder with the bookmark stored for it.
 */

import { exists, readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';
import { askForFolder, bookmarkFolder, openFolder } from '../src/folderAccess';

jest.mock('../src/folderAccess', () => ({
  askForFolder: jest.fn(async () => null),
  bookmarkFolder: jest.fn(async () => null),
  openFolder: jest.fn(async () => null),
  closeFolder: jest.fn(),
  watchFile: jest.fn(() => () => {}),
}));

const fs = { readDir, readFile } as unknown as {
  readDir: jest.Mock;
  readFile: jest.Mock;
};
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const access = { askForFolder, bookmarkFolder, openFolder } as unknown as {
  askForFolder: jest.Mock;
  bookmarkFolder: jest.Mock;
  openFolder: jest.Mock;
};
const existsMock = exists as jest.Mock;

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
  existsMock.mockImplementation(async () => true);
  access.askForFolder.mockImplementation(async () => null);
  access.bookmarkFolder.mockImplementation(async () => null);
  access.openFolder.mockImplementation(async () => null);
  mockFs({
    '/notes': ['a.md'],
    '/docs': ['d.md'],
    '/moved': ['moved.md'],
    '/work': ['w.md'],
  });
  fs.readFile.mockImplementation(async (path: string) => `# ${path}`);
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

async function openMenu(
  tree: ReactTestRenderer.ReactTestRenderer,
): Promise<void> {
  await press(button(tree, 'Recent folders'));
}

/** The folder open at launch, plus a second folder in the menu. */
async function storeNotesAndDocs(): Promise<void> {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFolderBookmark', 'NOTES');
  await storage.setItem('mdviewer.lastFile', '/notes/a.md');
  await storage.setItem(
    'mdviewer.recentFolders',
    JSON.stringify([
      { path: '/notes', bookmark: 'NOTES' },
      { path: '/docs', bookmark: 'DOCS' },
    ]),
  );
  access.openFolder.mockImplementation(async (bookmark: string) => {
    if (bookmark === 'NOTES') {
      return { path: '/notes', isStale: false };
    }
    if (bookmark === 'DOCS') {
      return { path: '/docs', isStale: false };
    }
    return null;
  });
}

it('puts the menu above Change Folder and opens the folder you pick', async () => {
  await storeNotesAndDocs();

  const tree = await renderApp();
  const text = textOf(tree);
  expect(text.indexOf('notes')).toBeLessThan(text.indexOf('Change Folder…'));
  expect(access.askForFolder).not.toHaveBeenCalled();

  await openMenu(tree);
  await press(button(tree, '/docs'));

  expect(access.openFolder).toHaveBeenCalledWith('DOCS');
  expect(textOf(tree)).toContain('d.md');
  expect(textOf(tree)).not.toContain('a.md');
  expect(access.askForFolder).not.toHaveBeenCalled();
});

it('does not open the folder that is already open', async () => {
  await storeNotesAndDocs();
  const tree = await renderApp();
  const calls = access.openFolder.mock.calls.length;

  await openMenu(tree);
  await press(button(tree, '/notes'));

  expect(access.openFolder.mock.calls.length).toBe(calls);
  expect(textOf(tree)).toContain('a.md');
});

it('adds a folder chosen from the panel', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFile', '/notes/a.md');
  access.askForFolder.mockResolvedValueOnce('/work');
  access.bookmarkFolder.mockResolvedValueOnce('WORK');

  const tree = await renderApp();
  await press(labeled(tree, 'Change Folder…'));
  await openMenu(tree);

  expect(button(tree, '/work')).toBeTruthy();
  expect(button(tree, '/notes')).toBeTruthy();
  expect(await storage.getItem('mdviewer.recentFolders')).toContain('WORK');
});

it('stays on the open folder when the chosen one cannot be opened', async () => {
  await storeNotesAndDocs();
  await storage.setItem(
    'mdviewer.recentFolders',
    JSON.stringify([
      { path: '/notes', bookmark: 'NOTES' },
      { path: '/gone', bookmark: 'GONE' },
    ]),
  );
  existsMock.mockImplementation(async (path: string) => path === '/notes');

  const tree = await renderApp();
  await openMenu(tree);
  await press(button(tree, '/gone'));

  expect(textOf(tree)).toContain('a.md');
  expect(textOf(tree)).toContain('Could not open that folder.');
});

it('stores a fresh bookmark when the chosen one is stale', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFolderBookmark', 'NOTES');
  await storage.setItem(
    'mdviewer.recentFolders',
    JSON.stringify([
      { path: '/notes', bookmark: 'NOTES' },
      { path: '/docs', bookmark: 'OLD' },
    ]),
  );
  access.openFolder.mockImplementation(async (bookmark: string) => {
    if (bookmark === 'NOTES') {
      return { path: '/notes', isStale: false };
    }
    if (bookmark === 'OLD') {
      return { path: '/docs', isStale: true };
    }
    return null;
  });
  access.bookmarkFolder.mockImplementation(async (path: string) =>
    path === '/docs' ? 'FRESH' : null,
  );

  const tree = await renderApp();
  await openMenu(tree);
  await press(button(tree, '/docs'));

  expect(await storage.getItem('mdviewer.lastFolderBookmark')).toBe('FRESH');
  expect(await storage.getItem('mdviewer.recentFolders')).toContain('FRESH');
  expect(textOf(tree)).toContain('d.md');
});

it('follows a bookmark when the folder has moved', async () => {
  await storeNotesAndDocs();
  access.openFolder.mockImplementation(async (bookmark: string) => {
    if (bookmark === 'NOTES') {
      return { path: '/notes', isStale: false };
    }
    if (bookmark === 'DOCS') {
      return { path: '/moved', isStale: false };
    }
    return null;
  });

  const tree = await renderApp();
  await openMenu(tree);
  await press(button(tree, '/docs'));

  expect(textOf(tree)).toContain('moved.md');
  const stored = await storage.getItem('mdviewer.recentFolders');
  expect(stored).toContain('/moved');
  expect(stored).not.toContain('/docs');
});

it('hides the menu until a folder has been opened', async () => {
  const tree = await renderApp();

  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Recent folders',
    ),
  ).toHaveLength(0);
  expect(access.askForFolder).toHaveBeenCalled();
});
