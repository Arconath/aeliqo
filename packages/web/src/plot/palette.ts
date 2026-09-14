export const QUANTITATIVE_COLOR_START = '#bfdbfe';
export const QUANTITATIVE_COLOR_END = '#4338ca';

/** The quantitative color key and marks share this bounded interpolation. */
export function quantitativeColor(ratio: number): string {
  const bounded = Math.min(1, Math.max(0, ratio));
  const red = Math.round(191 + (67 - 191) * bounded);
  const green = Math.round(219 + (56 - 219) * bounded);
  const blue = Math.round(254 + (202 - 254) * bounded);
  return `rgb(${red} ${green} ${blue})`;
}
