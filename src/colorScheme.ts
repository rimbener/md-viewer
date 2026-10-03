export const COLOR_SCHEME_IDS = ['system', 'light', 'dark'] as const;

export type ColorSchemeId = (typeof COLOR_SCHEME_IDS)[number];

export const DEFAULT_COLOR_SCHEME_ID: ColorSchemeId = 'system';

export const COLOR_SCHEMES: readonly { id: ColorSchemeId; name: string }[] = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

export function isColorSchemeId(value: unknown): value is ColorSchemeId {
  return (
    typeof value === 'string' &&
    (COLOR_SCHEME_IDS as readonly string[]).includes(value)
  );
}
