/**
 * Turns a markdown image source into something `Image` can load.
 *
 * Relative sources resolve against the directory of the document they appear
 * in; absolute ones become `file://` URLs. Anything already carrying a scheme
 * (`https:`, `data:`, `file:`) is passed through untouched.
 */
export function resolveUri(source: string, basePath: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(source)) {
    return source;
  }
  const path = source.startsWith('/')
    ? source
    : joinPath(basePath, decodeUri(source));
  return `file://${encodeURI(path)}`;
}

/** A malformed escape should not take the whole render down. */
function decodeUri(source: string): string {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

/** Resolves `.` and `..` against an absolute base directory. */
function joinPath(base: string, relative: string): string {
  const segments: string[] = [];
  for (const segment of `${base}/${relative}`.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}
