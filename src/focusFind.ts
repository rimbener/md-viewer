/**
 * Cmd+F is the Find menu item. The menu tells the app, and the field focuses.
 * Without the native module the shortcut does nothing, which is what tests see.
 */

import { NativeEventEmitter, NativeModules } from 'react-native';

type FindFocusModule = {
  addListener(eventType: string): void;
  removeListeners(count: number): void;
};

export function onFocusFind(focus: () => void): () => void {
  const native: FindFocusModule | undefined = NativeModules.FindFocus;
  if (native == null) {
    return () => {};
  }
  try {
    const sub = new NativeEventEmitter(native).addListener('focusFind', focus);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
