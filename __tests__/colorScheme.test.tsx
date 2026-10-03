/**
 * The color scheme control on the file name row.
 */

import { readFile } from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { ColorSchemeProvider } from '../src/components/ColorSchemeProvider';
import { DocumentPanel } from '../src/components/DocumentPanel';
import type { FileNode } from '../src/types';

const fs = { readFile } as unknown as { readFile: jest.Mock };
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const file: FileNode = {
  kind: 'file',
  name: 'notes.md',
  path: '/notes/notes.md',
};

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  fs.readFile.mockResolvedValue('# Notes');
});

afterEach(async () => {
  for (const tree of trees.splice(0)) {
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  }
});

async function renderPanel(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ColorSchemeProvider>
        <DocumentPanel
          file={file}
          isSidebarVisible
          onToggleSidebar={() => {}}
          canGoBack={false}
          canGoNext={false}
          onBack={() => {}}
          onNext={() => {}}
        />
      </ColorSchemeProvider>,
    );
  });
  for (let pass = 0; pass < 6; pass += 1) {
    await ReactTestRenderer.act(async () => {});
  }
  trees.push(tree!);
  return tree!;
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter((child): child is string => typeof child === 'string');
}

function nameColor(tree: ReactTestRenderer.ReactTestRenderer): string {
  const name = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'notes.md');
  if (name === undefined) {
    throw new Error('no file name');
  }
  return StyleSheet.flatten(name.props.style).color;
}

function schemeButton(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  return tree.root.findByProps({ accessibilityLabel: label });
}

it('sits on the file name row, to the right of the name', async () => {
  const labels = texts(await renderPanel());
  const name = labels.indexOf('notes.md');
  const system = labels.indexOf('System');
  const sidebar = labels.indexOf('Sidebar');

  expect(name).toBeGreaterThanOrEqual(0);
  expect(name).toBeLessThan(system);
  expect(system).toBeLessThan(sidebar);
});

it('starts on System and switches the document to dark', async () => {
  const tree = await renderPanel();

  expect(
    schemeButton(tree, 'System color scheme').props.accessibilityState,
  ).toEqual({
    selected: true,
  });
  expect(nameColor(tree)).toBe('#1c1c1e');

  await ReactTestRenderer.act(async () => {
    schemeButton(tree, 'Dark color scheme').props.onPress();
  });

  expect(nameColor(tree)).toBe('#ececee');
  expect(
    schemeButton(tree, 'Dark color scheme').props.accessibilityState,
  ).toEqual({
    selected: true,
  });
  expect(storage.setItem).toHaveBeenCalledWith('mdviewer.colorScheme', 'dark');
});

it('restores a stored scheme', async () => {
  await storage.setItem('mdviewer.colorScheme', 'dark');

  expect(nameColor(await renderPanel())).toBe('#ececee');
});
