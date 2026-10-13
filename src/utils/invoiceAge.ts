/**
 * @file invoiceAge.ts
 * @description Dynamic invoice age calculation and progressive urgency styling utilities.
 * 
 * Provides centralized age computation for accounts receivable and credit due tracking:
 * - Computes elapsed days between invoice issuance timestamp and the current local date.
 * - Categorizes aging urgency across predefined executive debt recovery thresholds:
 *   - Recent (< 14 days): Subtle slate/zinc soft pill
 *   - Caution (14 - 30 days): Amber cautionary pill
 *   - Overdue (> 30 days): Crimson warning pill
 */

/**
 * Metric breakdown and CSS styling tokens for invoice due aging.
 */
export interface InvoiceAgeInfo {
  /** Elapsed calendar days since the invoice was issued */
  days: number;
  /** Human-readable age indicator (e.g., 'Today', '1d ago', '14d ago') */
  label: string;
  /** Urgency tier based on aging thresholds */
  urgency: 'recent' | 'caution' | 'overdue';
  /** Tailwind CSS utility classes applying progressive urgency colors and borders */
  badgeClassName: string;
}

/**
 * Computes the relative aging metrics and visual styling for an unpaid invoice due balance.
 *
 * @param createdAt - ISO timestamp string or Date object representing the invoice creation timestamp
 * @param referenceDate - Optional reference date for testing or backdated reconciliation (defaults to now)
 * @returns {InvoiceAgeInfo} Object containing calculated days, formatted label, urgency tier, and styling classes
 *
 * @example
 * ```ts
 * const { label, badgeClassName } = getInvoiceAgeInfo(invoice.createdAt);
 * // For 5 days old: { days: 5, label: '5d ago', urgency: 'recent', badgeClassName: '...' }
 * // For 22 days old: { days: 22, label: '22d ago', urgency: 'caution', badgeClassName: '...' }
 * // For 45 days old: { days: 45, label: '45d ago', urgency: 'overdue', badgeClassName: '...' }
 * ```
 */
export function getInvoiceAgeInfo(
  createdAt: string | Date | undefined | null,
  referenceDate: Date = new Date()
): InvoiceAgeInfo {
  if (!createdAt) {
    return {
      days: 0,
      label: 'Today',
      urgency: 'recent',
      badgeClassName:
        'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-700/80',
    };
  }

  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) {
    return {
      days: 0,
      label: 'Today',
      urgency: 'recent',
      badgeClassName:
        'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-700/80',
    };
  }

  const nowTime = referenceDate.getTime();
  // Ensure non-negative difference in case of clock drifts
  const diffMs = Math.max(0, nowTime - createdTime);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  if (days === 0) {
    label = 'Today';
  } else if (days === 1) {
    label = '1d ago';
  } else {
    label = `${days}d ago`;
  }

  let urgency: 'recent' | 'caution' | 'overdue';
  let badgeClassName: string;

  if (days < 14) {
    urgency = 'recent';
    badgeClassName =
      'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-700/80';
  } else if (days <= 30) {
    urgency = 'caution';
    badgeClassName =
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
  } else {
    urgency = 'overdue';
    badgeClassName =
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
  }

  return {
    days,
    label,
    urgency,
    badgeClassName,
  };
}
