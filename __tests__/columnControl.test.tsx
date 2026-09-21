/**
 * Changing the line length, and remembering the choice.
 */

import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { pickDirectory } from 'react-native-document-picker-macos';

import App from '../App';
import { DEFAULT_CHARACTERS } from '../src/column';
import { columnWidth, DEFAULT_SCHEME_ID, schemeById } from '../src/typography';
import { DEFAULT_ZOOM } from '../src/zoom';

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
  await storage.setItem('mdviewer.lastFile', '/notes/notes.md');
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
  return tree!;
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

async function press(node: ReactTestRenderer.ReactTestInstance): Promise<void> {
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
}

function columnMaxWidth(tree: ReactTestRenderer.ReactTestRenderer): number {
  const [column] = tree.root.findAll(node => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.alignSelf === 'center' && typeof style.maxWidth === 'number';
  });
  return StyleSheet.flatten(column.props.style).maxWidth as number;
}

function widthAt(characters: number): number {
  return columnWidth(schemeById(DEFAULT_SCHEME_ID), DEFAULT_ZOOM, characters);
}

it('starts at 100 characters', async () => {
  const tree = await renderApp();
  expect(columnMaxWidth(tree)).toBe(widthAt(DEFAULT_CHARACTERS));
  expect(button(tree, 'Reset line length').props.disabled).toBe(true);
});

it('widens and narrows five characters at a time', async () => {
  const tree = await renderApp();

  await press(button(tree, 'Increase line length'));
  expect(columnMaxWidth(tree)).toBe(widthAt(105));

  await press(button(tree, 'Decrease line length'));
  await press(button(tree, 'Decrease line length'));
  expect(columnMaxWidth(tree)).toBe(widthAt(95));
});

it('resets to 100 when the number is pressed', async () => {
  const tree = await renderApp();
  await press(button(tree, 'Increase line length'));

  await press(button(tree, 'Reset line length'));

  expect(columnMaxWidth(tree)).toBe(widthAt(DEFAULT_CHARACTERS));
});

it('remembers the chosen line length', async () => {
  await press(button(await renderApp(), 'Increase line length'));

  await expect(storage.getItem('mdviewer.characters')).resolves.toBe('105');
});

it('opens at the stored line length', async () => {
  await storage.setItem('mdviewer.characters', '80');

  const tree = await renderApp();

  expect(columnMaxWidth(tree)).toBe(widthAt(80));
  expect(button(tree, 'Reset line length').props.disabled).toBe(false);
});
