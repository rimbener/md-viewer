/**
 * Zoom levels for the document panel, kept apart from the control that drives
 * them so that storage code can validate a value without pulling in the UI.
 */

/** Zoom factors the control steps through; 1 is the natural size. */
export const ZOOM_LEVELS = [0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

export const DEFAULT_ZOOM = 1;

/** Nearest step in `ZOOM_LEVELS`, moved by `direction` steps. */
export function stepZoom(scale: number, direction: number): number {
  const current = ZOOM_LEVELS.indexOf(scale);
  const index = current === -1 ? ZOOM_LEVELS.indexOf(DEFAULT_ZOOM) : current;
  const next = Math.min(Math.max(index + direction, 0), ZOOM_LEVELS.length - 1);
  return ZOOM_LEVELS[next];
}

/** Guards against values from an older build or a hand-edited store. */
export function isZoomLevel(value: unknown): value is number {
  return typeof value === 'number' && ZOOM_LEVELS.includes(value);
}
