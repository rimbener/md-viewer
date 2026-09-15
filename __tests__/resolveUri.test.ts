import { resolveUri } from '../src/markdown/resolveUri';

const BASE = '/Users/me/notes/guide';

describe('resolveUri', () => {
  it('passes through sources that already have a scheme', () => {
    expect(resolveUri('https://x.dev/a.png', BASE)).toBe('https://x.dev/a.png');
    expect(resolveUri('data:image/png;base64,AA', BASE)).toBe(
      'data:image/png;base64,AA',
    );
  });

  it('resolves relative paths against the document folder', () => {
    expect(resolveUri('img/a.png', BASE)).toBe(
      'file:///Users/me/notes/guide/img/a.png',
    );
    expect(resolveUri('./a.png', BASE)).toBe(
      'file:///Users/me/notes/guide/a.png',
    );
    expect(resolveUri('../shared/a.png', BASE)).toBe(
      'file:///Users/me/notes/shared/a.png',
    );
  });

  it('keeps absolute paths as they are', () => {
    expect(resolveUri('/tmp/a.png', BASE)).toBe('file:///tmp/a.png');
  });

  it('encodes spaces exactly once', () => {
    expect(resolveUri('my image.png', BASE)).toBe(
      'file:///Users/me/notes/guide/my%20image.png',
    );
    expect(resolveUri('my%20image.png', BASE)).toBe(
      'file:///Users/me/notes/guide/my%20image.png',
    );
  });
});
