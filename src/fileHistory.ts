/**
 * The files opened inside one folder, and where Back and Next stand in that
 * list. The list is pure data: `preferences.ts` is what writes it to disk.
 */

/** How many opens one folder remembers. Older ones fall off the front. */
const MAX_VISITS = 100;

export interface FileHistory {
  paths: readonly string[];
  /** -1 when `paths` is empty. */
  index: number;
}

const EMPTY: FileHistory = { paths: [], index: -1 };

export function emptyFileHistory(): FileHistory {
  return EMPTY;
}

export function currentHistoryPath(history: FileHistory): string | null {
  return history.paths[history.index] ?? null;
}

export function canGoBack(history: FileHistory): boolean {
  return history.index > 0;
}

export function canGoNext(history: FileHistory): boolean {
  return history.index >= 0 && history.index < history.paths.length - 1;
}

/** Drops entries ahead of the cursor, so Next does not return to a branch you left. */
export function recordVisit(history: FileHistory, path: string): FileHistory {
  if (history.paths[history.index] === path) {
    return history;
  }
  const kept = history.paths.slice(0, history.index + 1);
  kept.push(path);
  const paths =
    kept.length > MAX_VISITS ? kept.slice(kept.length - MAX_VISITS) : kept;
  return { paths, index: paths.length - 1 };
}

export function stepBack(history: FileHistory): FileHistory {
  if (!canGoBack(history)) {
    return history;
  }
  return { paths: history.paths, index: history.index - 1 };
}

export function stepNext(history: FileHistory): FileHistory {
  if (!canGoNext(history)) {
    return history;
  }
  return { paths: history.paths, index: history.index + 1 };
}

/** Clicks before the read returns sit on an empty list; replay them onto the stored one. */
export function applyLoadedHistory(
  stored: FileHistory,
  visited: FileHistory,
  openedAt: string | null,
): FileHistory {
  let next = stored;
  if (openedAt !== null && currentHistoryPath(next) !== openedAt) {
    next = recordVisit(next, openedAt);
  }
  for (const path of visited.paths) {
    next = recordVisit(next, path);
  }
  return next;
}

/** Rewrites paths after a bookmark follows a folder that moved. */
export function retargetHistory(
  history: FileHistory,
  from: string,
  to: string,
): FileHistory {
  if (from === to || history.paths.length === 0) {
    return history;
  }
  const fromPrefix = `${from}/`;
  const toPrefix = `${to}/`;
  let changed = false;
  const paths = history.paths.map(path => {
    if (!path.startsWith(fromPrefix)) {
      return path;
    }
    changed = true;
    return toPrefix + path.slice(fromPrefix.length);
  });
  return changed ? { paths, index: history.index } : history;
}

/** A stored list for `folder`, or empty when the value is unusable. */
export function decodeFileHistory(
  value: string | null,
  folder: string,
): FileHistory {
  if (value === null) {
    return EMPTY;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return EMPTY;
  }
  if (parsed === null || typeof parsed !== 'object') {
    return EMPTY;
  }
  const record = parsed as { paths?: unknown; index?: unknown };
  if (!Array.isArray(record.paths) || !Number.isInteger(record.index)) {
    return EMPTY;
  }
  const prefix = `${folder}/`;
  const index = record.index as number;
  const kept: string[] = [];
  let cursor = -1;
  for (let position = 0; position < record.paths.length; position += 1) {
    const path = record.paths[position];
    if (typeof path !== 'string' || !path.startsWith(prefix)) {
      continue;
    }
    if (position === index) {
      cursor = kept.length;
    }
    kept.push(path);
  }
  const overflow = kept.length - MAX_VISITS;
  const paths = overflow > 0 ? kept.slice(overflow) : kept;
  if (overflow > 0 && cursor >= 0) {
    cursor -= overflow;
  }
  if (paths.length === 0) {
    return EMPTY;
  }
  if (cursor < 0 || cursor >= paths.length) {
    cursor = paths.length - 1;
  }
  return { paths, index: cursor };
}

export function encodeFileHistory(history: FileHistory): string {
  return JSON.stringify({ paths: history.paths, index: history.index });
}
