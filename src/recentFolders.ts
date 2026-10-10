/**
 * The folders opened most recently. Pure data: `preferences.ts` writes it.
 * Newest folder first. A bookmark is the grant a sandboxed build needs to
 * open that folder again.
 */

/** How many folders the menu keeps. Older ones fall off the end. */
export const MAX_RECENT_FOLDERS = 10;

export type RecentFolder = {
  path: string;
  bookmark: string | null;
};

/** Puts `folder` first. `replacedPath` is the path a bookmark left behind. */
export function rememberFolder(
  folders: readonly RecentFolder[],
  folder: RecentFolder,
  replacedPath: string | null = null,
): RecentFolder[] {
  if (!folder.path.startsWith('/')) {
    return folders.slice(0, MAX_RECENT_FOLDERS);
  }
  const bookmark =
    folder.bookmark === null || folder.bookmark === '' ? null : folder.bookmark;
  const next = [
    { path: folder.path, bookmark },
    ...folders.filter(
      item => item.path !== folder.path && item.path !== replacedPath,
    ),
  ];
  return next.slice(0, MAX_RECENT_FOLDERS);
}

/** A stored list, or empty when the value is unusable. */
export function decodeRecentFolders(value: string | null): RecentFolder[] {
  if (value === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const folders: RecentFolder[] = [];
  for (const item of parsed) {
    if (folders.length >= MAX_RECENT_FOLDERS) {
      break;
    }
    const folder = asRecentFolder(item);
    if (folder === null || folders.some(kept => kept.path === folder.path)) {
      continue;
    }
    folders.push(folder);
  }
  return folders;
}

export function encodeRecentFolders(folders: readonly RecentFolder[]): string {
  return JSON.stringify(
    folders.map(folder => ({ path: folder.path, bookmark: folder.bookmark })),
  );
}

/**
 * The folder name. When two folders share that name, the parent folder is
 * added. When that still collides, the full path is used.
 */
export function recentFolderLabel(
  path: string,
  folders: readonly { path: string }[],
): string {
  const name = baseName(path);
  const sameName = folders.filter(folder => baseName(folder.path) === name);
  if (sameName.length < 2) {
    return name;
  }
  const parent = parentBase(path);
  if (parent.length === 0) {
    return path;
  }
  const qualified = `${parent}/${name}`;
  const sameQualified = sameName.filter(
    folder =>
      `${parentBase(folder.path)}/${baseName(folder.path)}` === qualified,
  );
  return sameQualified.length < 2 ? qualified : path;
}

function asRecentFolder(item: unknown): RecentFolder | null {
  if (item === null || typeof item !== 'object') {
    return null;
  }
  const record = item as { path?: unknown; bookmark?: unknown };
  if (typeof record.path !== 'string' || !record.path.startsWith('/')) {
    return null;
  }
  const bookmark =
    typeof record.bookmark === 'string' && record.bookmark !== ''
      ? record.bookmark
      : null;
  return { path: record.path, bookmark };
}

function baseName(path: string): string {
  const trimmed =
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const slash = trimmed.lastIndexOf('/');
  const name = slash < 0 ? trimmed : trimmed.slice(slash + 1);
  return name.length > 0 ? name : path;
}

function parentBase(path: string): string {
  const trimmed =
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0) {
    return '';
  }
  return baseName(trimmed.slice(0, slash));
}
