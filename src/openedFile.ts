/**
 * A file Finder opened in this app.
 *
 * The grant covers that file and ends with the process. It is not a folder
 * bookmark, so the path is not stored for the next launch.
 */

import { NativeEventEmitter, NativeModules } from 'react-native';

type OpenedFileModule = {
  take(): Promise<string | null>;
  addListener(eventType: string): void;
  removeListeners(count: number): void;
};

function native(): OpenedFileModule | undefined {
  return (NativeModules as { OpenedFile?: OpenedFileModule }).OpenedFile;
}

/** The file Finder already handed over, or null when launch opened none. */
export async function takeOpenedFile(): Promise<string | null> {
  try {
    const path = await native()?.take();
    return typeof path === 'string' && path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

/** Calls `onOpen` when Finder opens a file while the app is running. */
export function watchOpenedFile(onOpen: (path: string) => void): () => void {
  const module = native();
  if (module === undefined) {
    return () => {};
  }
  try {
    const sub = new NativeEventEmitter(module).addListener(
      'openedFile',
      (event: { path?: string }) => {
        if (typeof event?.path === 'string' && event.path.length > 0) {
          onOpen(event.path);
        }
      },
    );
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
