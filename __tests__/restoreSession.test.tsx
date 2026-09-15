/**
 * The launch path that reopens the last session, end to end: stored folder →
 * scan → stored file selected → its markdown rendered.
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
  picker.mockResolvedValue([]);
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
