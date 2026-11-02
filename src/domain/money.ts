import type { FC } from './types';

/** Indicative FC → USD rate ("taux indicatif du jour"). Matches the Figma figures (95 000 FC ≈ 34 $). */
export const FC_PER_USD = 2800;

const NBSP = ' ';

/** 520000 → "520 000 FC" (French thousands separator, non-breaking). */
export function formatFC(amount: FC): string {
  const sign = amount < 0 ? '− ' : '';
  const digits = Math.round(Math.abs(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${grouped}${NBSP}FC`;
}

export function toUSD(amount: FC): number {
  return Math.round(amount / FC_PER_USD);
}

/** 520000 → "≈ 186 $" */
export function formatUSD(amount: FC): string {
  return `≈${NBSP}${toUSD(amount)}${NBSP}$`;
}
