const TRILLION = 1_000_000_000_000;
const BILLION = 1_000_000_000;
const MILLION = 1_000_000;

/**
 * Abbreviates a VND value to M/B/T shorthand.
 * e.g. 1_500_000 → "1.5M VND"
 *      2_400_000_000 → "2.4B VND"
 *      1_200_000_000_000 → "1.2T VND"
 */
export function abbreviateVND(value: number): string {
  const prefix = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= TRILLION) {
    return `${prefix}${(abs / TRILLION).toFixed(1).replace(/\.0$/, '')}T VND`;
  }
  if (abs >= BILLION) {
    return `${prefix}${(abs / BILLION).toFixed(1).replace(/\.0$/, '')}B VND`;
  }
  if (abs >= MILLION) {
    return `${prefix}${(abs / MILLION).toFixed(1).replace(/\.0$/, '')}M VND`;
  }
  return formatVND(value);
}

/**
 * Formats a VND value as a full comma-separated number.
 * Negative values display with minus prefix.
 * e.g. 1500000 → "-1,500,000 VND" or "1,500,000 VND"
 */
export function formatVND(value: number, opts?: { showUnit?: boolean }): string {
  const showUnit = opts?.showUnit ?? true;
  const formatted = new Intl.NumberFormat('vi-VN').format(Math.abs(value));
  const prefix = value < 0 ? '-' : '';
  return showUnit ? `${prefix}${formatted} VND` : `${prefix}${formatted}`;
}

/**
 * Parses a VND TEXT string from the DB (e.g. "2450000.0000") to a JS number.
 * Returns 0 for null/undefined/invalid values.
 */
export function parseVND(text: string | null | undefined): number {
  if (!text) return 0;
  const n = parseFloat(text);
  return isNaN(n) ? 0 : n;
}

/**
 * Converts a JS number to a 4-decimal-place TEXT string for DB storage.
 * e.g. 2450000 → "2450000.0000"
 */
export function toVNDText(value: number): string {
  return value.toFixed(4);
}
