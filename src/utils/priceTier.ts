import { useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type PriceTier = 'w' | 'r';

export const PRICE_TIER_STORAGE_KEY = 'reliance_price_tier';

/**
 * Reads persisted price tier from sessionStorage or localStorage.
 * Defaults to 'r' (Retail).
 */
export function getStoredPriceTier(): PriceTier {
  if (typeof window === 'undefined') return 'r';
  try {
    const sessionVal = sessionStorage.getItem(PRICE_TIER_STORAGE_KEY);
    if (sessionVal === 'w' || sessionVal === 'r') return sessionVal;
    const localVal = localStorage.getItem(PRICE_TIER_STORAGE_KEY);
    if (localVal === 'w' || localVal === 'r') return localVal;
  } catch {
    // Fallback if storage access is restricted
  }
  return 'r';
}

/**
 * Persists price tier into both sessionStorage and localStorage.
 */
export function setStoredPriceTier(tier: PriceTier): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PRICE_TIER_STORAGE_KEY, tier);
    localStorage.setItem(PRICE_TIER_STORAGE_KEY, tier);
  } catch {
    // Storage write exception safety
  }
}

/**
 * Appends the active price tier query param to any internal URL if active tier is Wholesale.
 */
export function appendTierToUrl(path: string, tier: PriceTier): string {
  if (tier !== 'w') return path;
  const hashParts = path.split('#');
  const pathWithoutHash = hashParts[0];
  const hash = hashParts.length > 1 ? `#${hashParts[1]}` : '';

  const separator = pathWithoutHash.includes('?') ? '&' : '?';
  return `${pathWithoutHash}${separator}tier=w${hash}`;
}

/**
 * React hook to access, synchronize, and propagate the active price tier across the storefront.
 */
export function usePriceTier() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTier = searchParams.get('tier') || searchParams.get('price');

  // Synchronize incoming query parameter with storage
  useEffect(() => {
    if (rawTier === 'w' || rawTier === 'wholesale') {
      setStoredPriceTier('w');
    } else if (rawTier === 'r' || rawTier === 'retail') {
      setStoredPriceTier('r');
    }
  }, [rawTier]);

  // Compute active tier: Query param takes immediate priority, followed by persisted storage
  const activeTier: PriceTier = useMemo(() => {
    if (rawTier === 'w' || rawTier === 'wholesale') return 'w';
    if (rawTier === 'r' || rawTier === 'retail') return 'r';
    return getStoredPriceTier();
  }, [rawTier]);

  const isWholesale = activeTier === 'w';
  const tierParam = isWholesale ? '?tier=w' : '?tier=r';

  const appendTier = useCallback(
    (path: string) => appendTierToUrl(path, activeTier),
    [activeTier]
  );

  const switchTier = useCallback(
    (tier: PriceTier) => {
      setStoredPriceTier(tier);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (tier === 'w') {
          next.set('tier', 'w');
        } else {
          next.delete('tier');
          next.delete('price');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  return {
    tier: activeTier,
    isWholesale,
    tierParam,
    appendTier,
    switchTier,
  };
}

