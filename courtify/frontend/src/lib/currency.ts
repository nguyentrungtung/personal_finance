// ─── Currency configuration ───────────────────────────────────────────────────

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  nameVi: string;
  decimals: number;
  locale: string;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'VND', symbol: '₫',   name: 'Vietnamese Dong',   nameVi: 'Việt Nam Đồng',    decimals: 0, locale: 'vi-VN' },
  { code: 'USD', symbol: '$',   name: 'US Dollar',          nameVi: 'Đô la Mỹ',         decimals: 2, locale: 'en-US' },
  { code: 'EUR', symbol: '€',   name: 'Euro',               nameVi: 'Euro',              decimals: 2, locale: 'de-DE' },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan',       nameVi: 'Nhân dân tệ (CNY)',decimals: 2, locale: 'zh-CN' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',       nameVi: 'Yên Nhật (JPY)',   decimals: 0, locale: 'ja-JP' },
  { code: 'KRW', symbol: '₩',   name: 'Korean Won',         nameVi: 'Won Hàn Quốc',     decimals: 0, locale: 'ko-KR' },
  { code: 'GBP', symbol: '£',   name: 'British Pound',      nameVi: 'Bảng Anh',         decimals: 2, locale: 'en-GB' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar',   nameVi: 'Đô la Singapore',  decimals: 2, locale: 'en-SG' },
  { code: 'THB', symbol: '฿',   name: 'Thai Baht',          nameVi: 'Baht Thái',        decimals: 2, locale: 'th-TH' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar',   nameVi: 'Đô la Hồng Kông', decimals: 2, locale: 'en-HK' },
];

// ─── Fallback rates: 1 VND = ? foreign unit ──────────────────────────────────
// Used when network unavailable. Updated 2026-05.
export const FALLBACK_RATES: Record<string, number> = {
  VND: 1,
  USD: 0.00004,      // 1 USD ≈ 25,000 VND
  EUR: 0.0000368,    // 1 EUR ≈ 27,200 VND
  CNY: 0.000289,     // 1 CNY ≈   3,450 VND
  JPY: 0.006,        // 1 JPY ≈     167 VND
  KRW: 0.054,        // 1 KRW ≈    18.5 VND
  GBP: 0.0000314,    // 1 GBP ≈  31,800 VND
  SGD: 0.0000534,    // 1 SGD ≈  18,700 VND
  THB: 0.00137,      // 1 THB ≈     730 VND
  HKD: 0.000311,     // 1 HKD ≈   3,215 VND
};

// ─── Manual override storage ──────────────────────────────────────────────────
// User can override any rate. Stored as "1 VND = X foreign unit" (same as FALLBACK_RATES)

const OVERRIDE_KEY = 'courtify_fx_overrides';

export function loadOverrides(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function saveOverride(code: string, vndPerUnit: number) {
  const overrides = loadOverrides();
  // Convert: user enters "1 USD = 25500 VND" → we store 1/25500 (1 VND = ? USD)
  overrides[code] = 1 / vndPerUnit;
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
}

export function clearOverride(code: string) {
  const overrides = loadOverrides();
  delete overrides[code];
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
}

/** Get 1 VND = ? foreign unit, applying override if set */
export function getEffectiveRate(code: string, apiRates: Record<string, number>): number {
  const overrides = loadOverrides();
  if (overrides[code] !== undefined) return overrides[code];
  return apiRates[code] ?? FALLBACK_RATES[code] ?? 1;
}

/** Get effective rates for all currencies (merging api + overrides) */
export function getEffectiveRates(apiRates: Record<string, number>): Record<string, number> {
  const overrides = loadOverrides();
  const merged: Record<string, number> = { ...apiRates };
  for (const [code, rate] of Object.entries(overrides)) {
    merged[code] = rate;
  }
  return merged;
}

// ─── Live rate fetch: open.er-api.com (VND base, free, no API key) ────────────

const API_CACHE_KEY = 'courtify_fx_api_rates';
const API_CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface ApiCache {
  rates: Record<string, number>; // 1 VND = ? foreign unit
  timestamp: number;
  source: string;
}

function loadApiCache(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(API_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as ApiCache;
    if (Date.now() - cache.timestamp > API_CACHE_TTL) return null;
    return cache.rates;
  } catch {
    return null;
  }
}

export interface FetchRatesResult {
  rates: Record<string, number>; // 1 VND = ? foreign unit (API only, no overrides)
  source: 'api' | 'cache' | 'fallback';
  updatedAt: Date | null;
}

export async function fetchApiRates(): Promise<FetchRatesResult> {
  // Return from cache if fresh
  const cached = loadApiCache();
  if (cached) {
    return { rates: cached, source: 'cache', updatedAt: new Date() };
  }

  try {
    // open.er-api.com: base VND, returns how many units of each currency per 1 VND
    const res = await fetch('https://open.er-api.com/v6/latest/VND', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json() as {
      result: string;
      rates: Record<string, number>;
      time_last_update_utc?: string;
    };

    if (json.result !== 'success') throw new Error('API error');

    // json.rates[CODE] = how many CODE per 1 VND = our "1 VND = X foreign" format
    const apiRates: Record<string, number> = { VND: 1 };
    for (const code of Object.keys(FALLBACK_RATES)) {
      if (code === 'VND') continue;
      apiRates[code] = json.rates[code] ?? FALLBACK_RATES[code];
    }

    // Cache the API rates
    const cache: ApiCache = { rates: apiRates, timestamp: Date.now(), source: 'open.er-api.com' };
    localStorage.setItem(API_CACHE_KEY, JSON.stringify(cache));

    return {
      rates: apiRates,
      source: 'api',
      updatedAt: json.time_last_update_utc ? new Date(json.time_last_update_utc) : new Date(),
    };
  } catch {
    return { rates: { ...FALLBACK_RATES }, source: 'fallback', updatedAt: null };
  }
}

/** Force re-fetch (ignore cache) */
export async function refreshApiRates(): Promise<FetchRatesResult> {
  localStorage.removeItem(API_CACHE_KEY);
  return fetchApiRates();
}

// ─── Currency preference storage ──────────────────────────────────────────────

const CURRENCY_KEY = 'courtify_currency';

export function getSavedCurrency(): string {
  return localStorage.getItem(CURRENCY_KEY) ?? 'VND';
}

export function saveCurrency(code: string) {
  localStorage.setItem(CURRENCY_KEY, code);
}

export function getCurrencyConfig(code: string): CurrencyConfig {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) ?? SUPPORTED_CURRENCIES[0];
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/** Convert VND → display currency using effective rates (api + overrides) */
export function vndToDisplay(vndAmount: number, targetCode: string, rates: Record<string, number>): number {
  if (targetCode === 'VND') return vndAmount;
  return vndAmount * (rates[targetCode] ?? FALLBACK_RATES[targetCode] ?? 1);
}

/** Convert display currency → VND */
export function displayToVnd(displayAmount: number, sourceCode: string, rates: Record<string, number>): number {
  if (sourceCode === 'VND') return displayAmount;
  const rate = rates[sourceCode] ?? FALLBACK_RATES[sourceCode] ?? 1;
  return rate === 0 ? 0 : displayAmount / rate;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, cfg: CurrencyConfig): string {
  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  }).format(amount);
  if (cfg.code === 'VND' || cfg.code === 'EUR') return `${formatted} ${cfg.symbol}`;
  return `${cfg.symbol}${formatted}`;
}

export function abbreviateCurrency(amount: number, cfg: CurrencyConfig): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  let s: string;
  if (abs >= 1_000_000_000) s = `${(abs / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000)  s = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000)      s = `${(abs / 1_000).toFixed(1)}K`;
  else                        s = abs.toFixed(cfg.decimals);
  if (cfg.code === 'VND' || cfg.code === 'EUR') return `${sign}${s} ${cfg.symbol}`;
  return `${sign}${cfg.symbol}${s}`;
}
