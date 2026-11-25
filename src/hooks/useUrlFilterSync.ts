import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import type { DateRange } from '../components/ui/date-range-picker';

/**
 * Parses `startDate` and `endDate` query parameters into a `DateRange` object
 * for initial state hydration on page load / browser refresh.
 */
export function getInitialDateRangeFromUrl(searchParams: URLSearchParams): DateRange | undefined {
  const fromStr = searchParams.get('startDate');
  if (!fromStr) return undefined;
  const from = new Date(fromStr);
  if (Number.isNaN(from.getTime())) return undefined;
  const toStr = searchParams.get('endDate');
  const to = toStr ? new Date(toStr) : undefined;
  return {
    from,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  };
}

/**
 * Parses a single `YYYY-MM-DD` URL query parameter into a valid `Date` or `undefined`.
 */
export function getInitialDateFromUrl(searchParams: URLSearchParams, key: string): Date | undefined {
  const val = searchParams.get(key);
  if (!val) return undefined;
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Formats a `Date` into `yyyy-MM-dd` for URL query parameters, or returns `undefined`.
 */
export function formatDateForUrl(date?: Date): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return format(date, 'yyyy-MM-dd');
}

/**
 * Returns today's calendar date string (`YYYY-MM-DD`) in `Asia/Colombo` (`+05:30`).
 */
export function getColomboTodayStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Returns a `DateRange` covering today (`00:00:00.000` to `23:59:59.999` in `+05:30`) for quick-filter buttons.
 */
export function getColomboTodayDateRange(): DateRange {
  const todayStr = getColomboTodayStr();
  return {
    from: new Date(`${todayStr}T00:00:00.000+05:30`),
    to: new Date(`${todayStr}T23:59:59.999+05:30`),
  };
}

/**
 * Checks whether the given `DateRange` corresponds strictly to today's `Asia/Colombo` (`+05:30`) date.
 */
export function isColomboTodayRange(dateRange?: DateRange): boolean {
  if (!dateRange?.from) return false;
  const todayStr = getColomboTodayStr();
  const fromStr = format(dateRange.from, 'yyyy-MM-dd');
  const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : fromStr;
  return fromStr === todayStr && toStr === todayStr;
}

/**
 * Single-source URL query parameter synchronization hook for filterable list/production pages.
 * Keeps active filters persisted in the URL across browser refreshes without competing effects.
 */
export function useUrlFilterSync(filters: Record<string, string | number | undefined | null>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedEntries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)] as [string, string]);
  const nextQueryString = new URLSearchParams(serializedEntries).toString();

  useEffect(() => {
    if (nextQueryString !== searchParams.toString()) {
      setSearchParams(new URLSearchParams(nextQueryString), { replace: true });
    }
  }, [nextQueryString, searchParams, setSearchParams]);
}
