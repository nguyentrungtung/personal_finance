import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode, createElement,
} from 'react';
import {
  fetchApiRates, refreshApiRates, getEffectiveRates,
  getSavedCurrency, saveCurrency, getCurrencyConfig,
  vndToDisplay, displayToVnd, formatCurrency, abbreviateCurrency,
  FALLBACK_RATES,
  type CurrencyConfig, type FetchRatesResult,
} from './currency';

export interface RateStatus {
  source: 'api' | 'cache' | 'fallback';
  updatedAt: Date | null;
  loading: boolean;
}

interface CurrencyContextValue {
  currency: CurrencyConfig;
  /** Raw API rates (1 VND = ? unit), before overrides */
  apiRates: Record<string, number>;
  /** Effective rates = apiRates merged with user overrides */
  rates: Record<string, number>;
  rateStatus: RateStatus;
  setCurrency: (code: string) => void;
  /** Force refresh rates from API */
  refreshRates: () => Promise<void>;
  /** Format a VND amount → display currency string */
  fmt: (vndAmount: number) => string;
  /** Abbreviate a VND amount → display currency short string */
  abbr: (vndAmount: number) => string;
  /** Convert VND → display currency number */
  toDisplay: (vndAmount: number) => number;
  /** Convert display currency → VND number */
  toVnd: (displayAmount: number) => number;
  /** Notify context that overrides have changed (re-merge rates) */
  reloadOverrides: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState(getSavedCurrency);
  const [apiRates, setApiRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [rateStatus, setRateStatus] = useState<RateStatus>({
    source: 'fallback', updatedAt: null, loading: true,
  });

  const applyResult = useCallback((result: FetchRatesResult) => {
    setApiRates(result.rates);
    setRates(getEffectiveRates(result.rates));
    setRateStatus({ source: result.source, updatedAt: result.updatedAt, loading: false });
  }, []);

  useEffect(() => {
    setRateStatus(s => ({ ...s, loading: true }));
    fetchApiRates().then(applyResult);
  }, [applyResult]);

  const refreshRates = useCallback(async () => {
    setRateStatus(s => ({ ...s, loading: true }));
    const result = await refreshApiRates();
    applyResult(result);
  }, [applyResult]);

  const reloadOverrides = useCallback(() => {
    setRates(getEffectiveRates(apiRates));
  }, [apiRates]);

  const setCurrency = useCallback((code: string) => {
    setCurrencyCode(code);
    saveCurrency(code);
  }, []);

  const currency = getCurrencyConfig(currencyCode);

  const fmt = useCallback(
    (vndAmount: number) => formatCurrency(vndToDisplay(vndAmount, currencyCode, rates), currency),
    [currencyCode, rates, currency],
  );

  const abbr = useCallback(
    (vndAmount: number) => abbreviateCurrency(vndToDisplay(vndAmount, currencyCode, rates), currency),
    [currencyCode, rates, currency],
  );

  const toDisplay = useCallback(
    (v: number) => vndToDisplay(v, currencyCode, rates),
    [currencyCode, rates],
  );

  const toVnd = useCallback(
    (d: number) => displayToVnd(d, currencyCode, rates),
    [currencyCode, rates],
  );

  return createElement(
    CurrencyContext.Provider,
    { value: { currency, apiRates, rates, rateStatus, setCurrency, refreshRates, reloadOverrides, fmt, abbr, toDisplay, toVnd } },
    children,
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
