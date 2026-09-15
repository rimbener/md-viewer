/**
 * Font schemes for the document panel.
 *
 * Only fonts that ship with macOS are used: bundling faces would bloat the app,
 * and the two Apple faces that would otherwise be obvious picks — New York and
 * SF Mono — are not addressable by name (only through private
 * `.AppleSystemUIFont*` identifiers), so they are deliberately absent.
 *
 * Each role carries a `scale`, the multiplier that makes that family look the
 * same size as the system font. It is derived from measured x-height per em
 * (SF Pro 0.508, Charter 0.486, Iowan Old Style 0.486, Seravek 0.480,
 * Avenir Next 0.468), because point size alone does not predict apparent size.
 *
 * `advance` is the measured average character width in ems, taken over a prose
 * sample rather than the alphabet so that letter frequency is accounted for.
 * It converts a target line length in characters into a column width in pixels.
 */

export interface FontRole {
  /** Undefined means the macOS system font, SF Pro. */
  family?: string;
  scale: number;
  /** Average character advance, in ems. Only the body role's is read. */
  advance: number;
}

export interface FontScheme {
  id: string;
  name: string;
  /** One line explaining what the scheme is for, shown as a tooltip. */
  description: string;
  heading: FontRole;
  body: FontRole;
  code: FontRole;
}

/**
 * Menlo is the code font in every scheme: of the monospaced faces macOS ships
 * it is the only one with real bold *and* italic, both of which this renderer
 * needs for code spans inside headings and emphasis. Its x-height per em
 * (0.547) is the largest of any face here, which is why code sits a little
 * below body size rather than matching it.
 */
const CODE: FontRole = { family: 'Menlo', scale: 1, advance: 0.6021 };

/** Nominal body size, before zoom and per-scheme scaling. */
export const BODY_SIZE = 14;

/**
 * Target line length, in characters. Prose is most comfortable between 45 and
 * 75; the upper end suits technical writing, whose lines carry identifiers and
 * code spans that read badly when broken across lines.
 */
const TARGET_CHARACTERS = 90;

/**
 * Width of the text column for a scheme at a given zoom. Because it is derived
 * from the body font's own measurements, every scheme yields the same number
 * of characters per line rather than the same number of pixels.
 */
export function columnWidth(scheme: FontScheme, zoom: number): number {
  const bodySize = BODY_SIZE * zoom * scheme.body.scale;
  return Math.round(TARGET_CHARACTERS * scheme.body.advance * bodySize);
}

export const FONT_SCHEMES: readonly FontScheme[] = [
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Charter body with system headings — long-form reading',
    heading: { scale: 1, advance: 0.4099 },
    body: { family: 'Charter', scale: 1.045, advance: 0.4362 },
    code: CODE,
  },
  {
    id: 'native',
    name: 'Native',
    description: 'The macOS system font throughout',
    heading: { scale: 1, advance: 0.4099 },
    body: { scale: 1, advance: 0.4099 },
    code: CODE,
  },
  {
    id: 'humanist',
    name: 'Humanist',
    description: 'Seravek body with Avenir Next headings — sans throughout',
    heading: { family: 'Avenir Next', scale: 1.085, advance: 0.4529 },
    body: { family: 'Seravek', scale: 1.058, advance: 0.4221 },
    code: CODE,
  },
  {
    id: 'book',
    name: 'Book',
    description: 'Iowan Old Style throughout — warmest for long specs',
    heading: { family: 'Iowan Old Style', scale: 1.045, advance: 0.4454 },
    body: { family: 'Iowan Old Style', scale: 1.045, advance: 0.4454 },
    code: CODE,
  },
];

export const DEFAULT_SCHEME_ID = 'editorial';

/** Falls back to the default for an unknown or missing id. */
export function schemeById(id: string | null): FontScheme {
  const found = FONT_SCHEMES.find(scheme => scheme.id === id);
  return (
    found ?? (FONT_SCHEMES.find(s => s.id === DEFAULT_SCHEME_ID) as FontScheme)
  );
}

/** The next scheme in the list, wrapping at the end. */
export function nextSchemeId(id: string): string {
  const index = FONT_SCHEMES.findIndex(scheme => scheme.id === id);
  return FONT_SCHEMES[(index + 1) % FONT_SCHEMES.length].id;
}

export function isSchemeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    FONT_SCHEMES.some(scheme => scheme.id === value)
  );
}
