import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadCharacters,
  loadFontScheme,
  loadLastFile,
  loadLastFolder,
  loadSidebarVisible,
  loadZoom,
  saveCharacters,
  saveFontScheme,
  saveLastFile,
  saveLastFolder,
  saveSidebarVisible,
  saveZoom,
} from '../src/preferences';

const KEY = 'mdviewer.zoom';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
});

describe('zoom persistence', () => {
  it('round-trips a zoom level', async () => {
    saveZoom(1.5);
    expect(storage.setItem).toHaveBeenCalledWith(KEY, '1.5');
    await expect(loadZoom()).resolves.toBe(1.5);
  });

  it('returns null when nothing has been stored', async () => {
    await expect(loadZoom()).resolves.toBeNull();
  });

  it('rejects a stored value that is not a known zoom step', async () => {
    await storage.setItem(KEY, '1.07');
    await expect(loadZoom()).resolves.toBeNull();

    await storage.setItem(KEY, '3.7');
    await expect(loadZoom()).resolves.toBeNull();

    await storage.setItem(KEY, 'huge');
    await expect(loadZoom()).resolves.toBeNull();
  });

  it('survives a storage failure on read', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('disk is on fire'));
    await expect(loadZoom()).resolves.toBeNull();
  });

  it('survives a storage failure on write', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('disk is on fire'));
    expect(() => saveZoom(2)).not.toThrow();
  });
});

describe('line length persistence', () => {
  const key = 'mdviewer.characters';

  it('round-trips a character count', async () => {
    saveCharacters(80);
    expect(storage.setItem).toHaveBeenCalledWith(key, '80');
    await expect(loadCharacters()).resolves.toBe(80);
  });

  it('returns null when nothing has been stored', async () => {
    await expect(loadCharacters()).resolves.toBeNull();
  });

  it('rejects a stored value that is not a known step', async () => {
    await storage.setItem(key, '97');
    await expect(loadCharacters()).resolves.toBeNull();

    await storage.setItem(key, 'huge');
    await expect(loadCharacters()).resolves.toBeNull();
  });

  it('survives a storage failure on read', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('disk is on fire'));
    await expect(loadCharacters()).resolves.toBeNull();
  });
});

describe('session persistence', () => {
  it('round-trips the last folder and file', async () => {
    saveLastFolder('/Users/me/notes');
    saveLastFile('/Users/me/notes/todo.md');

    await expect(loadLastFolder()).resolves.toBe('/Users/me/notes');
    await expect(loadLastFile()).resolves.toBe('/Users/me/notes/todo.md');
  });

  it('forgets the file when passed null', async () => {
    saveLastFile('/Users/me/notes/todo.md');
    saveLastFile(null);
    await expect(loadLastFile()).resolves.toBeNull();
  });

  it('rejects a stored value that is not an absolute path', async () => {
    await storage.setItem('mdviewer.lastFolder', 'notes');
    await expect(loadLastFolder()).resolves.toBeNull();
  });

  it('survives a storage failure', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('disk is on fire'));
    await expect(loadLastFolder()).resolves.toBeNull();
  });
});

describe('font scheme persistence', () => {
  it('round-trips a scheme id', async () => {
    saveFontScheme('humanist');
    await expect(loadFontScheme()).resolves.toBe('humanist');
  });

  it('rejects an id that no longer exists', async () => {
    await storage.setItem('mdviewer.fontScheme', 'retired-scheme');
    await expect(loadFontScheme()).resolves.toBeNull();
  });
});

describe('sidebar visibility persistence', () => {
  it('round-trips both states', async () => {
    saveSidebarVisible(false);
    await expect(loadSidebarVisible()).resolves.toBe(false);

    saveSidebarVisible(true);
    await expect(loadSidebarVisible()).resolves.toBe(true);
  });

  it('returns null when nothing has been stored, so the caller decides', async () => {
    await expect(loadSidebarVisible()).resolves.toBeNull();
  });
});
