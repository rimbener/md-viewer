import { readDir, type ReadDirResItemT } from '@dr.pogodin/react-native-fs';

import type { DirectoryNode, FileNode, TreeNode } from './types';

/** Extensions treated as markdown. */
const MARKDOWN_EXTENSIONS = ['.md', '.mdc'];

/** Each walk is shallow; a deeper folder is read when selected. */
const MAX_DEPTH = 3;

function isMarkdown(name: string): boolean {
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some(extension => lower.endsWith(extension));
}

/**
 * Directories that hold machine data rather than anything anyone wrote: build
 * output, caches and dependency trees. They are large and any markdown inside
 * them belongs to a tool, so walking them mostly costs time.
 *
 * Hidden directories are otherwise walked like any other: `.claude`, `.github`
 * and `.cursor` are where a lot of specs live.
 */
const SKIPPED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.venv',
  '.next',
  '.expo',
  '.gradle',
  '.cache',
];

function isSkipped(name: string): boolean {
  return SKIPPED_DIRECTORIES.includes(name);
}

function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) {
    return a.kind === 'directory' ? -1 : 1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

async function scan(
  path: string,
  name: string,
  depth: number,
): Promise<DirectoryNode> {
  const children: TreeNode[] = [];

  // A directory we lack permission to read should not sink the whole scan.
  let entries: ReadDirResItemT[];
  try {
    entries = await readDir(path);
  } catch {
    entries = [];
  }

  const directories = entries.filter(
    entry => entry.isDirectory() && !isSkipped(entry.name),
  );

  if (depth + 1 < MAX_DEPTH) {
    const subdirectories = await Promise.all(
      directories.map(entry => scan(entry.path, entry.name, depth + 1)),
    );

    for (const subdirectory of subdirectories) {
      // Prune branches with no markdown anywhere beneath them.
      if (subdirectory.children.length > 0) {
        children.push(subdirectory);
      }
    }
  } else {
    // A folder past the walk must stay visible so a click can read it.
    for (const entry of directories) {
      children.push({
        kind: 'directory',
        name: entry.name,
        path: entry.path,
        children: [],
      });
    }
  }

  for (const entry of entries) {
    if (entry.isFile() && isMarkdown(entry.name)) {
      children.push({ kind: 'file', name: entry.name, path: entry.path });
    }
  }

  children.sort(compareNodes);

  return { kind: 'directory', name, path, children };
}

/**
 * Walks `rootPath` and returns a tree containing only markdown files and the
 * directories leading to them.
 */
export async function scanDirectory(rootPath: string): Promise<DirectoryNode> {
  const name = rootPath.split('/').filter(Boolean).pop() ?? rootPath;
  return scan(rootPath, name, 0);
}

/** Replaces the directory at `replacement.path` and leaves every other branch. */
export function replaceDirectory(
  tree: DirectoryNode,
  replacement: DirectoryNode,
): DirectoryNode {
  if (tree.path === replacement.path) {
    return replacement;
  }
  if (!replacement.path.startsWith(`${tree.path}/`)) {
    return tree;
  }

  let changed = false;
  const children = tree.children.map(child => {
    if (child.kind !== 'directory') {
      return child;
    }
    const next = replaceDirectory(child, replacement);
    if (next !== child) {
      changed = true;
    }
    return next;
  });

  return changed ? { ...tree, children } : tree;
}

/** Walks from `rootPath` until `filePath` is a node, or the ancestors run out. */
export async function scanToFile(
  rootPath: string,
  filePath: string,
): Promise<DirectoryNode> {
  let tree = await scanDirectory(rootPath);
  if (findFile(tree, filePath) !== null) {
    return tree;
  }

  for (const ancestor of ancestorPaths(filePath, rootPath).reverse()) {
    if (ancestor === rootPath) {
      continue;
    }
    tree = replaceDirectory(tree, await scanDirectory(ancestor));
    if (findFile(tree, filePath) !== null) {
      return tree;
    }
  }

  return tree;
}

/** Total number of markdown files in a tree. */
export function countFiles(node: TreeNode): number {
  if (node.kind === 'file') {
    return 1;
  }
  return node.children.reduce((total, child) => total + countFiles(child), 0);
}

/** The file node at `path`, or null when the tree no longer contains it. */
export function findFile(node: TreeNode, path: string): FileNode | null {
  if (node.kind === 'file') {
    return node.path === path ? node : null;
  }
  // Only descend into the branch that could hold the path.
  if (!path.startsWith(`${node.path}/`)) {
    return null;
  }
  for (const child of node.children) {
    const found = findFile(child, path);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

/**
 * Directories between `rootPath` and `path`, which are exactly the ones that
 * have to be open for `path` to be visible in the tree.
 */
export function ancestorPaths(path: string, rootPath: string): string[] {
  const ancestors: string[] = [];
  let current = path.slice(0, path.lastIndexOf('/'));

  while (current.length >= rootPath.length && current.startsWith(rootPath)) {
    ancestors.push(current);
    const separator = current.lastIndexOf('/');
    if (separator <= 0) {
      break;
    }
    current = current.slice(0, separator);
  }
  return ancestors;
}
