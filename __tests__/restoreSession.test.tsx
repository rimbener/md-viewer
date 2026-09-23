/**
 * The launch path that reopens the last session, end to end: stored folder →
 * scan → stored file selected → its markdown rendered. A sandboxed build
 * reaches that folder through a stored bookmark, so the folder access is
 * mocked here the way the native modules are.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
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
/** The open dialog, which the app only reaches when nothing can be restored. */
const picker = access.askForFolder;

/** One directory holding `notes.md` and `todo.md`. */
function mockFolder(): void {
  fs.readDir.mockImplementation(async (path: string) => {
    if (path !== '/notes') {
      throw new Error(`ENOENT: ${path}`);
    }
    return ['notes.md', 'todo.md'].map(name => ({
      name,
      path: `/notes/${name}`,
      isFile: () => true,
      isDirectory: () => false,
    }));
  });
}

type Rendered = ReactTestRenderer.ReactTestRendererJSON;

/**
 * Every string the tree renders. Walking `children` alone keeps this away from
 * the props, which hold structures that cannot be serialised.
 */
function collectText(node: Rendered | string | null): string[] {
  if (node === null) {
    return [];
  }
  if (typeof node === 'string') {
    return [node];
  }
  return (node.children ?? []).flatMap(collectText);
}

/** Renders the app and lets every queued promise settle. */
async function renderApp(): Promise<string> {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
  const root = tree!.toJSON();
  const roots = Array.isArray(root) ? root : [root];
  return roots.flatMap(collectText).join('\n');
}

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  mockFolder();
  fs.readFile.mockResolvedValue('# Yesterday\n\nStill here.');
  picker.mockResolvedValue(null);
});

it('reopens the stored folder and file without asking', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFile', '/notes/todo.md');

  const rendered = await renderApp();

  expect(picker).not.toHaveBeenCalled();
  expect(rendered).toContain('todo.md');
  // The document panel header, then the rendered markdown itself.
  expect(rendered).toContain('/notes/todo.md');
  expect(rendered).toContain('Yesterday');
});

it('asks for a folder when nothing was stored', async () => {
  await renderApp();

  expect(picker).toHaveBeenCalled();
});

it('reopens the folder but selects nothing when the file is gone', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFile', '/notes/deleted.md');

  const rendered = await renderApp();

  expect(picker).not.toHaveBeenCalled();
  expect(rendered).toContain('notes.md');
  expect(rendered).toContain('Select a markdown file from the sidebar.');
});

it('falls back to the dialog when the stored folder is gone', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  const { exists } = jest.requireMock('@dr.pogodin/react-native-fs');
  (exists as jest.Mock).mockResolvedValueOnce(false);

  await renderApp();

  expect(picker).toHaveBeenCalled();
});

it('reopens the folder the bookmark points at, wherever it moved to', async () => {
  await storage.setItem('mdviewer.lastFolder', '/before-the-move');
  await storage.setItem('mdviewer.lastFolderBookmark', 'BOOKMARK');
  access.openFolder.mockResolvedValueOnce({ path: '/notes', isStale: false });

  const rendered = await renderApp();

  expect(access.openFolder).toHaveBeenCalledWith('BOOKMARK');
  expect(picker).not.toHaveBeenCalled();
  expect(rendered).toContain('notes.md');
  expect(await storage.getItem('mdviewer.lastFolder')).toBe('/notes');
});

it('asks for a folder when the stored bookmark no longer opens', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFolderBookmark', 'BOOKMARK');
  const { exists } = jest.requireMock('@dr.pogodin/react-native-fs');
  (exists as jest.Mock).mockResolvedValueOnce(false);

  await renderApp();

  expect(picker).toHaveBeenCalled();
});

it('makes the bookmark again when the resolved one is stale', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFolderBookmark', 'OLD');
  access.openFolder.mockResolvedValueOnce({ path: '/notes', isStale: true });
  access.bookmarkFolder.mockResolvedValueOnce('FRESH');

  await renderApp();

  expect(await storage.getItem('mdviewer.lastFolderBookmark')).toBe('FRESH');
});

it('moves the open file and its history when the bookmarked folder moved', async () => {
  await storage.setItem('mdviewer.lastFolder', '/before');
  await storage.setItem('mdviewer.lastFolderBookmark', 'BOOKMARK');
  await storage.setItem('mdviewer.lastFile', '/before/todo.md');
  await storage.setItem(
    'mdviewer.fileHistory:/before',
    JSON.stringify({
      paths: ['/before/notes.md', '/before/todo.md'],
      index: 1,
    }),
  );
  access.openFolder.mockResolvedValueOnce({ path: '/notes', isStale: false });

  const rendered = await renderApp();

  expect(rendered).toContain('/notes/todo.md');
  expect(await storage.getItem('mdviewer.lastFile')).toBe('/notes/todo.md');
  expect(await storage.getItem('mdviewer.fileHistory:/before')).toBeNull();
  expect(await storage.getItem('mdviewer.fileHistory:/notes')).toContain(
    '/notes/notes.md',
  );
});

it('stores a bookmark for the folder someone picks', async () => {
  picker.mockResolvedValue('/notes');
  access.bookmarkFolder.mockResolvedValueOnce('BOOKMARK');

  const rendered = await renderApp();

  expect(access.bookmarkFolder).toHaveBeenCalledWith('/notes');
  expect(await storage.getItem('mdviewer.lastFolderBookmark')).toBe('BOOKMARK');
  expect(rendered).toContain('notes.md');
});
