import {
  applyLoadedHistory,
  canGoBack,
  canGoNext,
  currentHistoryPath,
  decodeFileHistory,
  emptyFileHistory,
  recordVisit,
  retargetHistory,
  stepBack,
  stepNext,
} from '../src/fileHistory';

const folder = '/notes';

function visit(...names: string[]) {
  return names.reduce(
    (history, name) => recordVisit(history, `${folder}/${name}`),
    emptyFileHistory(),
  );
}

describe('recordVisit', () => {
  it('appends a file and stands on it', () => {
    const history = visit('a.md', 'b.md');

    expect(history.paths).toEqual(['/notes/a.md', '/notes/b.md']);
    expect(currentHistoryPath(history)).toBe('/notes/b.md');
    expect(canGoBack(history)).toBe(true);
    expect(canGoNext(history)).toBe(false);
  });

  it('ignores a second open of the file already showing', () => {
    const history = visit('a.md');

    expect(recordVisit(history, '/notes/a.md')).toBe(history);
  });

  it('drops the files ahead when a new file is opened after Back', () => {
    const history = stepBack(visit('a.md', 'b.md'));
    const next = recordVisit(history, '/notes/c.md');

    expect(next.paths).toEqual(['/notes/a.md', '/notes/c.md']);
    expect(canGoNext(next)).toBe(false);
  });

  it('keeps the last 100 opens', () => {
    let history = emptyFileHistory();
    for (let index = 0; index < 120; index += 1) {
      history = recordVisit(history, `/notes/${index}.md`);
    }

    expect(history.paths).toHaveLength(100);
    expect(history.paths[0]).toBe('/notes/20.md');
    expect(currentHistoryPath(history)).toBe('/notes/119.md');
  });
});

describe('stepBack and stepNext', () => {
  it('moves the cursor and stops at each end', () => {
    const history = visit('a.md', 'b.md');
    const back = stepBack(history);

    expect(currentHistoryPath(back)).toBe('/notes/a.md');
    expect(stepBack(back)).toBe(back);
    expect(currentHistoryPath(stepNext(back))).toBe('/notes/b.md');
    expect(stepNext(history)).toBe(history);
  });
});

describe('applyLoadedHistory', () => {
  it('replays clicks that happened before the stored list arrived', () => {
    const stored = visit('a.md', 'b.md');
    const clicked = recordVisit(emptyFileHistory(), '/notes/c.md');

    const next = applyLoadedHistory(stored, clicked, '/notes/b.md');

    expect(next.paths).toEqual(['/notes/a.md', '/notes/b.md', '/notes/c.md']);
  });

  it('keeps the restored file ahead of a click that landed first', () => {
    const clicked = recordVisit(emptyFileHistory(), '/notes/b.md');

    const next = applyLoadedHistory(emptyFileHistory(), clicked, '/notes/a.md');

    expect(next.paths).toEqual(['/notes/a.md', '/notes/b.md']);
  });

  it('adds the restored file when the stored list does not end on it', () => {
    const next = applyLoadedHistory(
      visit('a.md'),
      emptyFileHistory(),
      '/notes/b.md',
    );

    expect(currentHistoryPath(next)).toBe('/notes/b.md');
    expect(next.paths).toEqual(['/notes/a.md', '/notes/b.md']);
  });

  it('leaves the stored list when nothing new happened', () => {
    const stored = visit('a.md');

    expect(applyLoadedHistory(stored, emptyFileHistory(), '/notes/a.md')).toBe(
      stored,
    );
  });
});

describe('retargetHistory', () => {
  it('rewrites paths onto the folder a bookmark followed', () => {
    const moved = retargetHistory(visit('a.md', 'b.md'), '/notes', '/moved');

    expect(moved.paths).toEqual(['/moved/a.md', '/moved/b.md']);
    expect(moved.index).toBe(1);
  });
});

describe('decodeFileHistory', () => {
  it('returns empty for unusable values', () => {
    expect(decodeFileHistory(null, folder)).toEqual(emptyFileHistory());
    expect(decodeFileHistory('{', folder)).toEqual(emptyFileHistory());
    expect(decodeFileHistory('{"paths":"no","index":0}', folder)).toEqual(
      emptyFileHistory(),
    );
  });

  it('drops paths that are not inside the folder and keeps the cursor', () => {
    const raw = JSON.stringify({
      paths: ['/notes/a.md', '/other/x.md', '/notes/a.md'],
      index: 2,
    });

    const history = decodeFileHistory(raw, folder);

    expect(history.paths).toEqual(['/notes/a.md', '/notes/a.md']);
    expect(history.index).toBe(1);
  });
});
