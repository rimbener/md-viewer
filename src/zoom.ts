/**
 * Zoom for the document panel, kept apart from the control that drives it so
 * that storage code can validate a value without pulling in the UI.
 */

export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.05;

/** 1 is the natural size. */
export const DEFAULT_ZOOM = 1;

const STEP_PERCENT = Math.round(ZOOM_STEP * 100);

function asPercent(scale: number): number {
  return Math.round(scale * 100);
}

/** Nearest step, moved by `direction` increments of 5%. */
export function stepZoom(scale: number, direction: number): number {
  const current = isZoomLevel(scale)
    ? asPercent(scale)
    : asPercent(DEFAULT_ZOOM);
  const next = Math.min(
    Math.max(current + direction * STEP_PERCENT, asPercent(MIN_ZOOM)),
    asPercent(MAX_ZOOM),
  );
  return next / 100;
}

/** Guards against values from an older build or a hand-edited store. */
export function isZoomLevel(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }
  const percent = asPercent(value);
  return (
    percent >= asPercent(MIN_ZOOM) &&
    percent <= asPercent(MAX_ZOOM) &&
    (percent - asPercent(MIN_ZOOM)) % STEP_PERCENT === 0
  );
}
