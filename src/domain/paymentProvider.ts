import type { MobileMoneyOperator, PaymentFailureReason, PaymentMethod } from './types';

/**
 * Mock Mobile Money / card provider. Deterministic so QA scenarios are reproducible:
 *  - number ending in 0000 → insufficient balance (C6)
 *  - number ending in 1111 → declined by the operator
 *  - number ending in 9999 → buyer never validates (request expires, C4 timer)
 *  - any other number      → approved after the buyer "types the PIN"
 */
export type ProviderOutcome = 'approved' | PaymentFailureReason | 'no_answer';

export interface ProviderDecision {
  outcome: ProviderOutcome;
  delayMs: number;
}

export function decidePayment(method: PaymentMethod, msisdn?: string): ProviderDecision {
  if (method === 'card') return { outcome: 'approved', delayMs: 1_500 };
  const digits = (msisdn ?? '').replace(/\D/g, '');
  if (digits.endsWith('0000')) return { outcome: 'insufficient_funds', delayMs: 3_000 };
  if (digits.endsWith('1111')) return { outcome: 'declined', delayMs: 3_000 };
  if (digits.endsWith('9999')) return { outcome: 'no_answer', delayMs: 0 };
  return { outcome: 'approved', delayMs: 4_000 };
}

/** RDC mobile prefixes → operator (Vodacom M-Pesa 81–83, Orange 84/85/89, Airtel 97–99). */
export function detectOperator(msisdn: string): MobileMoneyOperator | null {
  const p = msisdn.replace(/\D/g, '').slice(0, 2);
  if (['81', '82', '83'].includes(p)) return 'M-Pesa';
  if (['84', '85', '89'].includes(p)) return 'Orange Money';
  if (['97', '98', '99'].includes(p)) return 'Airtel Money';
  return null;
}

/** "812345678" → "81 234 5678" while typing. */
export function formatLocalMsisdn(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}
