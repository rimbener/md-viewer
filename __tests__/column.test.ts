import {
  DEFAULT_CHARACTERS,
  MAX_CHARACTERS,
  MIN_CHARACTERS,
  stepCharacters,
} from '../src/column';

describe('stepCharacters', () => {
  it('moves five characters at a time', () => {
    expect(stepCharacters(DEFAULT_CHARACTERS, 1)).toBe(105);
    expect(stepCharacters(DEFAULT_CHARACTERS, -1)).toBe(95);
  });

  it('stops at both ends instead of wrapping', () => {
    expect(stepCharacters(MIN_CHARACTERS, -1)).toBe(MIN_CHARACTERS);
    expect(stepCharacters(MAX_CHARACTERS, 1)).toBe(MAX_CHARACTERS);
  });

  it('falls back to the default for an unknown count', () => {
    expect(stepCharacters(97, 1)).toBe(105);
  });
});
