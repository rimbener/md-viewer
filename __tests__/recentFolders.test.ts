import {
  decodeRecentFolders,
  encodeRecentFolders,
  recentFolderLabel,
  rememberFolder,
  type RecentFolder,
} from '../src/recentFolders';

function folder(path: string, bookmark: string | null = null): RecentFolder {
  return { path, bookmark };
}

describe('rememberFolder', () => {
  it('puts the newest folder first and drops the path a move left behind', () => {
    const stored = [folder('/docs', 'DOCS'), folder('/old', 'OLD')];

    expect(rememberFolder(stored, folder('/notes', 'NOTES'), '/old')).toEqual([
      folder('/notes', 'NOTES'),
      folder('/docs', 'DOCS'),
    ]);
  });

  it('moves a folder that is opened again to the front and keeps its new bookmark', () => {
    const stored = [folder('/docs'), folder('/notes', 'OLD')];

    expect(rememberFolder(stored, folder('/notes', 'NEW'))).toEqual([
      folder('/notes', 'NEW'),
      folder('/docs'),
    ]);
  });

  it('keeps the 10 folders opened most recently', () => {
    let stored: RecentFolder[] = [];
    for (let index = 0; index < 12; index += 1) {
      stored = rememberFolder(stored, folder(`/folder/${index}`));
    }

    expect(stored.map(item => item.path)).toEqual(
      Array.from({ length: 10 }, (_, index) => `/folder/${11 - index}`),
    );
  });

  it('ignores a path that is not absolute', () => {
    expect(rememberFolder([folder('/notes')], folder('notes'))).toEqual([
      folder('/notes'),
    ]);
  });

  it('stores an empty bookmark as none', () => {
    expect(rememberFolder([], folder('/notes', ''))).toEqual([
      folder('/notes', null),
    ]);
  });
});

describe('decodeRecentFolders', () => {
  it('round-trips a list', () => {
    const stored = [folder('/notes', 'NOTES'), folder('/docs')];
    expect(decodeRecentFolders(encodeRecentFolders(stored))).toEqual(stored);
  });

  it('returns empty for an unusable value', () => {
    expect(decodeRecentFolders(null)).toEqual([]);
    expect(decodeRecentFolders('not json')).toEqual([]);
    expect(decodeRecentFolders('{}')).toEqual([]);
  });

  it('drops entries that are not absolute paths and keeps the first of a duplicate', () => {
    const value = JSON.stringify([
      { path: 'notes', bookmark: 'NO' },
      { path: '/notes', bookmark: 'YES' },
      { path: '/notes', bookmark: 'AGAIN' },
      { path: '/docs', bookmark: '' },
    ]);

    expect(decodeRecentFolders(value)).toEqual([
      folder('/notes', 'YES'),
      folder('/docs'),
    ]);
  });
});

describe('recentFolderLabel', () => {
  it('uses the folder name', () => {
    expect(
      recentFolderLabel('/Users/me/notes', [folder('/Users/me/notes')]),
    ).toBe('notes');
  });

  it('adds the parent folder when two names match', () => {
    const folders = [folder('/Users/me/notes'), folder('/Users/you/notes')];

    expect(recentFolderLabel('/Users/me/notes', folders)).toBe('me/notes');
    expect(recentFolderLabel('/Users/you/notes', folders)).toBe('you/notes');
  });

  it('uses the full path when the parent folder also matches', () => {
    const folders = [folder('/a/me/notes'), folder('/b/me/notes')];

    expect(recentFolderLabel('/a/me/notes', folders)).toBe('/a/me/notes');
    expect(recentFolderLabel('/b/me/notes', folders)).toBe('/b/me/notes');
  });

  it('uses the full path for a top-level folder that shares a name', () => {
    const folders = [folder('/notes'), folder('/work/notes')];

    expect(recentFolderLabel('/notes', folders)).toBe('/notes');
    expect(recentFolderLabel('/work/notes', folders)).toBe('work/notes');
  });
});
