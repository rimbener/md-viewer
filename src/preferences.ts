/**
 * Viewer preferences that outlive a launch: the zoom level, the sidebar
 * visibility, and the folder and file that were open last.
 *
 * Storage is best-effort: a read that fails falls back to the default and a
 * write that fails is dropped, because losing a preference is never worth
 * interrupting someone's reading.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSchemeId } from './typography';
import { isZoomLevel } from './zoom';

const ZOOM_KEY = 'mdviewer.zoom';
const FOLDER_KEY = 'mdviewer.lastFolder';
const FILE_KEY = 'mdviewer.lastFile';
const FONT_KEY = 'mdviewer.fontScheme';
const SIDEBAR_KEY = 'mdviewer.sidebarVisible';

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

/** The folder open when the app last closed. */
export async function loadLastFolder(): Promise<string | null> {
  return asPath(await read(FOLDER_KEY));
}

export function saveLastFolder(path: string): void {
  write(FOLDER_KEY, path);
}

/** The file open when the app last closed. */
export async function loadLastFile(): Promise<string | null> {
  return asPath(await read(FILE_KEY));
}

/** Passing null forgets the file, which is what changing folder should do. */
export function saveLastFile(path: string | null): void {
  write(FILE_KEY, path);
}
