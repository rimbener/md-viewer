/**
 * Viewer preferences that outlive a launch: the zoom level, the line length,
 * the sidebar and editor visibility, the folder and file that were open last,
 * and the files opened in each folder.
 *
 * Storage is best-effort: a read that fails falls back to the default and a
 * write that fails is dropped, because losing a preference is never worth
 * interrupting someone's reading.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isCharacterCount } from './column';
import {
  decodeFileHistory,
  encodeFileHistory,
  type FileHistory,
} from './fileHistory';
import { isSchemeId } from './typography';
import { isZoomLevel } from './zoom';

const ZOOM_KEY = 'mdviewer.zoom';
const CHARACTERS_KEY = 'mdviewer.characters';
const FOLDER_KEY = 'mdviewer.lastFolder';
const BOOKMARK_KEY = 'mdviewer.lastFolderBookmark';
const FILE_KEY = 'mdviewer.lastFile';
const FONT_KEY = 'mdviewer.fontScheme';
const SIDEBAR_KEY = 'mdviewer.sidebarVisible';
const EDITOR_KEY = 'mdviewer.editorVisible';
const HISTORY_INDEX_KEY = 'mdviewer.fileHistoryFolders';

/** Lists kept on disk. A folder opened earlier than these loses its list. */
const MAX_HISTORY_FOLDERS = 20;

function historyKey(folder: string): string {
  return `mdviewer.fileHistory:${folder}`;
}

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A null value removes the key. */
function write(key: string, value: string | null): void {
  const operation =
    value === null
      ? AsyncStorage.removeItem(key)
      : AsyncStorage.setItem(key, value);
  operation.catch(() => {});
}

/** Rejects anything that is not an absolute path. */
function asPath(value: string | null): string | null {
  return value !== null && value.startsWith('/') ? value : null;
}

/** The stored zoom level, or null when there is no usable one. */
export async function loadZoom(): Promise<number | null> {
  const stored = await read(ZOOM_KEY);
  if (stored === null) {
    return null;
  }
  const value = Number.parseFloat(stored);
  return isZoomLevel(value) ? value : null;
}

/** Records the zoom level for the next launch; failures are ignored. */
export function saveZoom(scale: number): void {
  write(ZOOM_KEY, String(scale));
}

/** The stored line length, or null when there is no usable one. */
export async function loadCharacters(): Promise<number | null> {
  const stored = await read(CHARACTERS_KEY);
  if (stored === null) {
    return null;
  }
  const value = Number.parseFloat(stored);
  return isCharacterCount(value) ? value : null;
}

/** Records the line length for the next launch; failures are ignored. */
export function saveCharacters(characters: number): void {
  write(CHARACTERS_KEY, String(characters));
}

/** The chosen font scheme, or null when there is no usable one. */
export async function loadFontScheme(): Promise<string | null> {
  const stored = await read(FONT_KEY);
  return isSchemeId(stored) ? stored : null;
}

export function saveFontScheme(schemeId: string): void {
  write(FONT_KEY, schemeId);
}

/**
 * Whether the file tree was showing, or null when that was never chosen. The
 * caller supplies the default, so it is not duplicated here.
 */
export async function loadSidebarVisible(): Promise<boolean | null> {
  const stored = await read(SIDEBAR_KEY);
  return stored === null ? null : stored === 'true';
}

export function saveSidebarVisible(isVisible: boolean): void {
  write(SIDEBAR_KEY, String(isVisible));
}

/** Whether the source editor was open, or null when that was never chosen. */
export async function loadEditorVisible(): Promise<boolean | null> {
  const stored = await read(EDITOR_KEY);
  return stored === null ? null : stored === 'true';
}

export function saveEditorVisible(isVisible: boolean): void {
  write(EDITOR_KEY, String(isVisible));
}

/** The folder open when the app last closed. */
export async function loadLastFolder(): Promise<string | null> {
  return asPath(await read(FOLDER_KEY));
}

export function saveLastFolder(path: string): void {
  write(FOLDER_KEY, path);
}

/**
 * The security-scoped bookmark for that folder — the grant a sandboxed build
 * needs to read it again. See `folderAccess.ts`.
 */
export async function loadFolderBookmark(): Promise<string | null> {
  const stored = await read(BOOKMARK_KEY);
  return stored === null || stored === '' ? null : stored;
}

/** Passing null forgets the grant, which is what changing folder should do. */
export function saveFolderBookmark(bookmark: string | null): void {
  write(BOOKMARK_KEY, bookmark);
}

/** The file open when the app last closed. */
export async function loadLastFile(): Promise<string | null> {
  return asPath(await read(FILE_KEY));
}

/** Passing null forgets the file, which is what changing folder should do. */
export function saveLastFile(path: string | null): void {
  write(FILE_KEY, path);
}

/** The files opened in `folder`, newest visit last, or empty when none are stored. */
export async function loadFileHistory(folder: string): Promise<FileHistory> {
  return decodeFileHistory(await read(historyKey(folder)), folder);
}

/** Records that list and marks `folder` as just opened. */
export function saveFileHistory(
  folder: string,
  history: FileHistory,
): Promise<void> {
  write(historyKey(folder), encodeFileHistory(history));
  return noteFolders(folder, null);
}

/** Moves a list onto the path a bookmark followed, and drops the old path. */
export function moveFileHistory(
  from: string,
  to: string,
  history: FileHistory,
): Promise<void> {
  write(historyKey(to), encodeFileHistory(history));
  return noteFolders(to, from);
}

function parseFolderList(value: string | null): string[] {
  if (value === null) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is string =>
        typeof item === 'string' && item.startsWith('/'),
    );
  } catch {
    return [];
  }
}

async function put(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch {}
}

// Later saves must see earlier index updates, or a dropped folder can return.
let folderQueue: Promise<void> = Promise.resolve();

function noteFolders(add: string, drop: string | null): Promise<void> {
  const run = folderQueue.then(async () => {
    const folders = parseFolderList(await read(HISTORY_INDEX_KEY)).filter(
      path => path !== add && path !== drop,
    );
    folders.push(add);
    const overflow = folders.length - MAX_HISTORY_FOLDERS;
    const removed = overflow > 0 ? folders.splice(0, overflow) : [];
    await put(HISTORY_INDEX_KEY, JSON.stringify(folders));
    if (drop !== null) {
      await put(historyKey(drop), null);
    }
    for (const path of removed) {
      await put(historyKey(path), null);
    }
  });
  folderQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return folderQueue;
}
