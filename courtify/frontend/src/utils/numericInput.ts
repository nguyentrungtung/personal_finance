/**
 * Utilities for numeric / currency input fields.
 *
 * Three patterns covered:
 *  1. numericInputProps   — spread onto any <input> for plain positive numbers (volume, weight, rate)
 *  2. signedNumericInputProps — same but allows leading minus (ledger amounts)
 *  3. numericKeyDown      — onKeyDown handler you can reuse in controlled inputs
 *  4. parseNumericInput   — clean a raw string to a parseable decimal string
 *  5. isValidNumeric      — zod-compatible refinement / general validation
 */

/** Keys always allowed regardless of input type */
const ALWAYS_ALLOWED = new Set([
  'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Tab', 'Enter', 'Home', 'End',
]);

/** Allow Ctrl/Meta combos (copy, paste, select-all) */
function isModifierCombo(e: React.KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase());
}

/**
 * onKeyDown handler for a plain positive decimal input.
 * Blocks every key that is not a digit, dot, or control key.
 */
export function numericKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (ALWAYS_ALLOWED.has(e.key) || isModifierCombo(e)) return;
  if (e.key >= '0' && e.key <= '9') return;
  if (e.key === '.') {
    // Only one dot allowed
    if ((e.currentTarget as HTMLInputElement).value.includes('.')) e.preventDefault();
    return;
  }
  e.preventDefault();
}

/**
 * onKeyDown handler for a signed decimal input (allows a leading minus).
 */
export function signedNumericKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (ALWAYS_ALLOWED.has(e.key) || isModifierCombo(e)) return;
  if (e.key >= '0' && e.key <= '9') return;
  if (e.key === '.') {
    if ((e.currentTarget as HTMLInputElement).value.includes('.')) e.preventDefault();
    return;
  }
  if (e.key === '-') {
    const el = e.currentTarget as HTMLInputElement;
    // Allow minus only at position 0 and only if not already there
    if (el.selectionStart === 0 && !el.value.startsWith('-')) return;
    e.preventDefault();
    return;
  }
  e.preventDefault();
}

/** Strip everything that is not part of a valid decimal number */
export function parseNumericInput(raw: string, allowNegative = false): string {
  let v = raw.replace(/,/g, '.');               // vi-VN comma → dot
  if (!allowNegative) v = v.replace(/-/g, '');  // strip minus if not allowed
  v = v.replace(/[^0-9.\-]/g, '');             // strip non-numeric
  // Keep only first dot
  const firstDot = v.indexOf('.');
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
  }
  return v;
}

/** Returns true if string is a valid positive decimal (for Zod refine / validate) */
export function isValidPositiveDecimal(v: string | undefined): boolean {
  if (!v) return false;
  return /^\d+(\.\d+)?$/.test(v.trim());
}

/** Returns true if string is a valid signed decimal */
export function isValidSignedDecimal(v: string | undefined): boolean {
  if (!v) return false;
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

/**
 * Spread these props onto a plain <input> for percentage / rate / volume fields.
 * Usage: <input {...numericInputProps} {...register('interest_rate')} />
 */
export const numericInputProps = {
  type: 'text' as const,
  inputMode: 'decimal' as const,
  autoComplete: 'off' as const,
  onKeyDown: numericKeyDown,
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!/^-?\d*\.?\d*$/.test(pasted)) e.preventDefault();
  },
} as const;

/**
 * Same as numericInputProps but allows a leading minus sign.
 */
export const signedNumericInputProps = {
  ...numericInputProps,
  onKeyDown: signedNumericKeyDown,
} as const;
