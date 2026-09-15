/**
 * @format
 */

import { readDir } from '@dr.pogodin/react-native-fs';

import {
  ancestorPaths,
  countFiles,
  findFile,
  scanDirectory,
} from '../src/scanDirectory';
import type { DirectoryNode, TreeNode } from '../src/types';

/** Maps a directory path to the names it contains; names ending in `/` are directories. */
type FakeFs = Record<string, string[]>;

function mockFs(fs: FakeFs) {
  (readDir as jest.Mock).mockImplementation(async (path: string) => {
    const entries = fs[path];
    if (!entries) {
      throw new Error(`ENOENT: ${path}`);
    }
    return entries.map(entry => {
      const isDirectory = entry.endsWith('/');
      const name = isDirectory ? entry.slice(0, -1) : entry;
      return {
        name,
        path: `${path}/${name}`,
        size: 0,
        isDirectory: () => isDirectory,
        isFile: () => !isDirectory,
      };
    });
  });
}

/** Compact view of a tree, for readable assertions. */
function outline(node: TreeNode, depth = 0): string[] {
  const line = `${'  '.repeat(depth)}${node.name}${
    node.kind === 'directory' ? '/' : ''
  }`;
  if (node.kind === 'file') {
    return [line];
  }
  return [line, ...node.children.flatMap(child => outline(child, depth + 1))];
}

beforeEach(() => {
  (readDir as jest.Mock).mockReset();
});

test('keeps only markdown files', async () => {
  mockFs({ '/docs': ['a.md', 'b.txt', 'c.MD', 'image.png'] });

  const tree = await scanDirectory('/docs');

  expect(tree.children.map(child => child.name)).toEqual(['a.md', 'c.MD']);
});

test('prunes directories with no markdown beneath them', async () => {
  mockFs({
    '/docs': ['empty/', 'nested/', 'top.md'],
    '/docs/empty': ['photo.png'],
    '/docs/nested': ['deep/'],
    '/docs/nested/deep': ['buried.md'],
  });

  const tree = await scanDirectory('/docs');

  expect(outline(tree)).toEqual([
    'docs/',
    '  nested/',
    '    deep/',
    '      buried.md',
    '  top.md',
  ]);
});

test('sorts directories before files, each alphabetically', async () => {
  mockFs({
    '/docs': ['zebra.md', 'Alpha.md', 'yaks/', 'Bears/'],
    '/docs/yaks': ['y.md'],
    '/docs/Bears': ['b.md'],
  });

  const tree = await scanDirectory('/docs');

  expect(tree.children.map(child => child.name)).toEqual([
    'Bears',
    'yaks',
    'Alpha.md',
    'zebra.md',
  ]);
});

test('shows hidden files and directories', async () => {
  mockFs({
    '/docs': ['.claude/', '.hidden.md', 'real.md'],
    '/docs/.claude': ['CLAUDE.md'],
  });

  const tree = await scanDirectory('/docs');

  expect(outline(tree)).toEqual([
    'docs/',
    '  .claude/',
    '    CLAUDE.md',
    '  .hidden.md',
    '  real.md',
  ]);
});

test('still skips build output, caches and dependency trees', async () => {
  const skipped = [
    'node_modules',
    '.git',
    '.venv',
    '.next',
    '.expo',
    '.gradle',
    '.cache',
  ];
  mockFs({
    '/docs': [...skipped.map(name => `${name}/`), 'real.md'],
    ...Object.fromEntries(
      skipped.map(name => [`/docs/${name}`, ['buried.md']]),
    ),
  });

  const tree = await scanDirectory('/docs');

  expect(tree.children.map(child => child.name)).toEqual(['real.md']);
});

test('survives an unreadable subdirectory', async () => {
  mockFs({ '/docs': ['locked/', 'ok.md'] }); // `/docs/locked` is absent, so readDir rejects.

  const tree = await scanDirectory('/docs');

  expect(tree.children.map(child => child.name)).toEqual(['ok.md']);
});

test('counts markdown files across the whole tree', async () => {
  mockFs({
    '/docs': ['one.md', 'sub/'],
    '/docs/sub': ['two.md', 'three.md'],
  });

  expect(countFiles(await scanDirectory('/docs'))).toBe(3);
});

describe('findFile', () => {
  const tree: DirectoryNode = {
    kind: 'directory',
    name: 'notes',
    path: '/notes',
    children: [
      {
        kind: 'directory',
        name: 'deep',
        path: '/notes/deep',
        children: [
          { kind: 'file', name: 'buried.md', path: '/notes/deep/buried.md' },
        ],
      },
      { kind: 'file', name: 'top.md', path: '/notes/top.md' },
    ],
  };

  it('finds a file at any depth', () => {
    expect(findFile(tree, '/notes/top.md')).toMatchObject({ name: 'top.md' });
    expect(findFile(tree, '/notes/deep/buried.md')).toMatchObject({
      name: 'buried.md',
    });
  });

  it('returns null for a path the tree does not hold', () => {
    expect(findFile(tree, '/notes/gone.md')).toBeNull();
    expect(findFile(tree, '/elsewhere/top.md')).toBeNull();
    // A directory is not a file, even when the path matches.
    expect(findFile(tree, '/notes/deep')).toBeNull();
  });
});

describe('ancestorPaths', () => {
  it('lists the directories between the root and the file', () => {
    expect(ancestorPaths('/notes/a/b/c.md', '/notes')).toEqual([
      '/notes/a/b',
      '/notes/a',
      '/notes',
    ]);
  });

  it('stops at the root', () => {
    expect(ancestorPaths('/notes/c.md', '/notes')).toEqual(['/notes']);
  });

  it('returns nothing for a path outside the root', () => {
    expect(ancestorPaths('/elsewhere/c.md', '/notes')).toEqual([]);
  });
});
