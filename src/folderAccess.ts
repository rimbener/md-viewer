/**
 * The folder grant, made durable.
 *
 * A sandboxed build reaches the chosen folder through the open panel, and that
 * grant dies with the process: a stored path alone reopens nothing. A
 * security-scoped bookmark is the grant written down — made while the panel's
 * grant is live, resolved on the next launch, and held open while the folder
 * is read.
 *
 * Like the preferences, this is best-effort: a build without the sandbox, or
 * without the native module, gets null everywhere and falls back to the stored
 * path, which is all an unsandboxed build ever needed.
 */

import { NativeModules } from 'react-native';

type OpenedFolder = {
  path: string;
  /** The folder moved, so the bookmark must be made again to stay usable. */
  isStale: boolean;
};

type FolderAccessModule = {
  bookmark(path: string): Promise<string | null>;
  open(bookmark: string): Promise<OpenedFolder | null>;
  close(): void;
};

const native: FolderAccessModule | undefined = NativeModules.FolderAccess;

/** A bookmark for a folder the app may read now, or null when it cannot. */
export async function bookmarkFolder(path: string): Promise<string | null> {
  try {
    return (await native?.bookmark(path)) ?? null;
  } catch {
    return null;
  }
}

/** Restores access to a bookmarked folder, or null when the grant is gone. */
export async function openFolder(
  bookmark: string,
): Promise<OpenedFolder | null> {
  try {
    return (await native?.open(bookmark)) ?? null;
  } catch {
    return null;
  }
}

/** Gives up the access held for the open folder. */
export function closeFolder(): void {
  try {
    native?.close();
  } catch {}
}
