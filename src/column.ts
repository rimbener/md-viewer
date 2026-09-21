/**
 * Target line length for the document panel, kept apart from the control that
 * drives it so that storage code can validate a value without pulling in the UI.
 */

export const MIN_CHARACTERS = 40;
export const MAX_CHARACTERS = 200;
export const CHARACTER_STEP = 5;

/** 100 suits technical writing better than the 45–75 range that prose prefers. */
export const DEFAULT_CHARACTERS = 100;

/** Nearest step, moved by `direction` increments of `CHARACTER_STEP`. */
export function stepCharacters(characters: number, direction: number): number {
  const current = isCharacterCount(characters)
    ? characters
    : DEFAULT_CHARACTERS;
  return Math.min(
    Math.max(current + direction * CHARACTER_STEP, MIN_CHARACTERS),
    MAX_CHARACTERS,
  );
}

/** Guards against values from an older build or a hand-edited store. */
export function isCharacterCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_CHARACTERS &&
    value <= MAX_CHARACTERS &&
    (value - MIN_CHARACTERS) % CHARACTER_STEP === 0
  );
}
