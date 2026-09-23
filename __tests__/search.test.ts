import { splitMatches } from '../src/search';

function joined(text: string, query: string, limit = 50): string {
  return splitMatches(text, query, limit)
    .parts.map(part => part.text)
    .join('');
}

describe('splitMatches', () => {
  it('marks without regard to letter case', () => {
    expect(splitMatches('A Note', 'note', 10).parts).toEqual([
      { text: 'A ', match: false },
      { text: 'Note', match: true },
    ]);
  });

  it('does not read the query as a pattern', () => {
    expect(splitMatches('axb', 'a.b', 10).parts).toEqual([
      { text: 'axb', match: false },
    ]);
  });

  it('does not overlap hits', () => {
    expect(splitMatches('aaaa', 'aa', 10)).toEqual({
      parts: [
        { text: 'aa', match: true },
        { text: 'aa', match: true },
      ],
      more: false,
    });
  });

  it('stops at the limit and keeps the rest plain', () => {
    const { parts, more } = splitMatches('ababab', 'ab', 2);

    expect(more).toBe(true);
    expect(parts.filter(part => part.match)).toHaveLength(2);
    expect(parts.map(part => part.text).join('')).toBe('ababab');
  });

  it('returns the text unchanged for an empty query', () => {
    expect(splitMatches('ab', '', 10).parts).toEqual([
      { text: 'ab', match: false },
    ]);
  });

  it('joins back to the source', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const text = bits(seed, 80);
      const query = bits(seed + 7, (seed % 4) + 1);
      expect(joined(text, query, 20)).toBe(text);
    }
  });
});

function bits(seed: number, length: number): string {
  let value = seed;
  let out = '';
  const alphabet = 'ab.*\\';
  for (let i = 0; i < length; i += 1) {
    value = Math.imul(value, 1664525) + 1013904223;
    value %= 4294967296;
    if (value < 0) {
      value += 4294967296;
    }
    out += alphabet.charAt(value % alphabet.length);
  }
  return out;
}
