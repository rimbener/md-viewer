/**
 * Finder can open one markdown file. That file is the whole tree: the stored
 * folder stays stored, and the directory beside the file is not read.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';
import { askForFolder, closeFolder } from '../src/folderAccess';

jest.mock('../src/folderAccess', () => ({
  askForFolder: jest.fn(async () => null),
  bookmarkFolder: jest.fn(async () => null),
  openFolder: jest.fn(async () => null),
  closeFolder: jest.fn(),
  watchFile: jest.fn(() => () => {}),
}));

type OpenedFileNative = {
  take: jest.Mock;
  addListener: jest.Mock;
  removeListeners: jest.Mock;
};

const nativeModules = NativeModules as { OpenedFile?: OpenedFileNative };
const fs = { readDir, readFile } as unknown as {
  readDir: jest.Mock;
  readFile: jest.Mock;
};
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const picker = askForFolder as jest.Mock;
const release = closeFolder as jest.Mock;

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

async function settle(): Promise<void> {
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
}

function textOf(tree: ReactTestRenderer.ReactTestRenderer): string {
  const root = tree.toJSON();
  const roots = Array.isArray(root) ? root : [root];
  return roots.flatMap(collectText).join('\n');
}

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  delete nativeModules.OpenedFile;
  fs.readDir.mockImplementation(async () => {
    throw new Error('the parent folder is not granted');
  });
  fs.readFile.mockImplementation(async (path: string) => {
    if (path === '/opened/readme.md') {
      return '# From Finder\n';
    }
    if (path === '/opened/other.mdc') {
      return '# Other\n';
    }
    return '';
  });
});

it('shows the file Finder opened and leaves the stored folder alone', async () => {
  await storage.setItem('mdviewer.lastFolder', '/notes');
  await storage.setItem('mdviewer.lastFile', '/notes/todo.md');
  nativeModules.OpenedFile = {
    take: jest.fn(async () => '/opened/readme.md'),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };

  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await settle();
  const rendered = textOf(tree!);

  expect(picker).not.toHaveBeenCalled();
  expect(fs.readDir).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalled();
  expect(rendered).toContain('readme.md');
  expect(rendered).toContain('From Finder');
  expect(rendered).not.toContain('todo.md');
  expect(await storage.getItem('mdviewer.lastFolder')).toBe('/notes');
  expect(await storage.getItem('mdviewer.lastFile')).toBe('/notes/todo.md');
});

it('switches to a file Finder opens while the app is running', async () => {
  let emit: (event: { path: string }) => void = () => {};
  nativeModules.OpenedFile = {
    take: jest.fn(async () => null),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  const spy = jest
    .spyOn(NativeEventEmitter.prototype, 'addListener')
    .mockImplementation((event, callback) => {
      if (event === 'openedFile') {
        emit = callback as (event: { path: string }) => void;
      }
      return { remove: jest.fn() } as unknown as ReturnType<
        NativeEventEmitter['addListener']
      >;
    });

  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await settle();
  try {
    await ReactTestRenderer.act(async () => {
      emit({ path: '/opened/other.mdc' });
    });
    await settle();
    const rendered = textOf(tree!);
    expect(rendered).toContain('other.mdc');
    expect(rendered).toContain('Other');
    expect(fs.readDir).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
