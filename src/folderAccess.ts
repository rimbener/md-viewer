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

import { NativeEventEmitter, NativeModules } from 'react-native';
import { pickDirectory } from 'react-native-document-picker-macos';

type OpenedFolder = {
  path: string;
  /** The folder moved, so the bookmark must be made again to stay usable. */
  isStale: boolean;
};

type FolderAccessModule = {
  choose(): Promise<string | null>;
  bookmark(path: string): Promise<string | null>;
  open(bookmark: string): Promise<OpenedFolder | null>;
  close(): void;
  watch(path: string): void;
  unwatch(): void;
  addListener(eventType: string): void;
  removeListeners(count: number): void;
};

const native: FolderAccessModule | undefined = NativeModules.FolderAccess;

let emitter: NativeEventEmitter | undefined;

function events(): NativeEventEmitter | undefined {
  if (native === undefined) {
    return undefined;
  }
  if (emitter === undefined) {
    emitter = new NativeEventEmitter(native);
  }
  return emitter;
}

/**
 * Asks for a folder, and answers with its path or null when the dialog was
 * cancelled.
 *
 * The panel is our own because it shows hidden files: the scan walks `.claude`
 * and the like, so one has to be pickable as the root. Without the native
 * module the packaged picker stands in, hiding them as the system does.
 */
export async function askForFolder(): Promise<string | null> {
  try {
    if (native !== undefined) {
      return (await native.choose()) ?? null;
    }
  } catch {
    return null;
  }
  const [directory] = await pickDirectory();
  return directory?.path ?? null;
}

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

/** Calls `onChange` when the file at `path` changes on disk. */
export function watchFile(path: string, onChange: () => void): () => void {
  const bus = events();
  if (bus === undefined || native === undefined) {
    return () => {};
  }

  try {
    const sub = bus.addListener('fileChanged', (event: { path?: string }) => {
      if (event.path === path) {
        onChange();
      }
    });
    try {
      native.watch(path);
    } catch {
      sub.remove();
      return () => {};
    }
    return () => {
      sub.remove();
      try {
        native.unwatch();
      } catch {}
    };
  } catch {
    return () => {};
  }
}
