/**
 * Case-insensitive find over one string. Kept apart from the field so the
 * mark logic can be tested without the UI.
 */

/** The field stops here. A longer query is not searched. */
export const MAX_QUERY_LENGTH = 200;

/**
 * Past this many hits the marks stop. One `Text` per hit, and more than this
 * stalls the UI thread.
 */
export const MAX_MATCHES = 500;

export type MatchPart = {
  text: string;
  match: boolean;
};

/**
 * Splits `text` on non-overlapping hits of `query`.
 * `limit` caps how many hits this call may mark; the rest of the string stays
 * plain and `more` says a further hit was left unmarked.
 */
export function splitMatches(
  text: string,
  query: string,
  limit: number,
): { parts: MatchPart[]; more: boolean } {
  if (
    query.length === 0 ||
    query.length > MAX_QUERY_LENGTH ||
    limit <= 0 ||
    text.length < query.length
  ) {
    return { parts: [{ text, match: false }], more: false };
  }

  const needle = query.toLowerCase();
  const hay = text.toLowerCase();
  // toLowerCase can grow a character (ß), so an index would slice the wrong span.
  if (needle.length !== query.length || hay.length !== text.length) {
    return { parts: [{ text, match: false }], more: false };
  }

  const parts: MatchPart[] = [];
  let cursor = 0;
  let matched = 0;

  while (cursor <= text.length - query.length && matched < limit) {
    const at = hay.indexOf(needle, cursor);
    if (at === -1) {
      break;
    }
    if (at > cursor) {
      parts.push({ text: text.slice(cursor, at), match: false });
    }
    parts.push({ text: text.slice(at, at + query.length), match: true });
    cursor = at + query.length;
    matched += 1;
  }

  const more = matched >= limit && hay.indexOf(needle, cursor) !== -1;
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }
  if (parts.length === 0) {
    parts.push({ text, match: false });
  }

  return { parts, more };
}
