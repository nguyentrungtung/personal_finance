export interface CountryPreset {
  code: string;
  flag: string;
  name: string;
  nameVi: string;
  timezone: string;
  currency: string;
  language: 'en' | 'vi';
  dateFormat: string;
  numberFormat: string; // display example
  numberSeparator: { decimal: string; thousands: string; decimals: number };
}

export const COUNTRY_PRESETS: CountryPreset[] = [
  {
    code: 'VN', flag: '🇻🇳', name: 'Vietnam', nameVi: 'Việt Nam',
    timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', language: 'vi',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1.234.567',
    numberSeparator: { decimal: ',', thousands: '.', decimals: 0 },
  },
  {
    code: 'US', flag: '🇺🇸', name: 'United States', nameVi: 'Hoa Kỳ',
    timezone: 'America/New_York', currency: 'USD', language: 'en',
    dateFormat: 'MM/DD/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'GB', flag: '🇬🇧', name: 'United Kingdom', nameVi: 'Anh',
    timezone: 'Europe/London', currency: 'GBP', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'JP', flag: '🇯🇵', name: 'Japan', nameVi: 'Nhật Bản',
    timezone: 'Asia/Tokyo', currency: 'JPY', language: 'en',
    dateFormat: 'YYYY/MM/DD', numberFormat: '1,234',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 0 },
  },
  {
    code: 'CN', flag: '🇨🇳', name: 'China', nameVi: 'Trung Quốc',
    timezone: 'Asia/Shanghai', currency: 'CNY', language: 'en',
    dateFormat: 'YYYY/MM/DD', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'KR', flag: '🇰🇷', name: 'South Korea', nameVi: 'Hàn Quốc',
    timezone: 'Asia/Seoul', currency: 'KRW', language: 'en',
    dateFormat: 'YYYY.MM.DD', numberFormat: '1,234',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 0 },
  },
  {
    code: 'SG', flag: '🇸🇬', name: 'Singapore', nameVi: 'Singapore',
    timezone: 'Asia/Singapore', currency: 'SGD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'HK', flag: '🇭🇰', name: 'Hong Kong', nameVi: 'Hồng Kông',
    timezone: 'Asia/Hong_Kong', currency: 'HKD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'TH', flag: '🇹🇭', name: 'Thailand', nameVi: 'Thái Lan',
    timezone: 'Asia/Bangkok', currency: 'THB', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'DE', flag: '🇩🇪', name: 'Germany', nameVi: 'Đức',
    timezone: 'Europe/Berlin', currency: 'EUR', language: 'en',
    dateFormat: 'DD.MM.YYYY', numberFormat: '1.234,56',
    numberSeparator: { decimal: ',', thousands: '.', decimals: 2 },
  },
  {
    code: 'FR', flag: '🇫🇷', name: 'France', nameVi: 'Pháp',
    timezone: 'Europe/Paris', currency: 'EUR', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1 234,56',
    numberSeparator: { decimal: ',', thousands: ' ', decimals: 2 },
  },
  {
    code: 'AU', flag: '🇦🇺', name: 'Australia', nameVi: 'Úc',
    timezone: 'Australia/Sydney', currency: 'USD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'CA', flag: '🇨🇦', name: 'Canada', nameVi: 'Canada',
    timezone: 'America/New_York', currency: 'USD', language: 'en',
    dateFormat: 'YYYY-MM-DD', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'IN', flag: '🇮🇳', name: 'India', nameVi: 'Ấn Độ',
    timezone: 'Asia/Kolkata', currency: 'USD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,23,456.78',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'AE', flag: '🇦🇪', name: 'UAE', nameVi: 'UAE',
    timezone: 'Asia/Dubai', currency: 'USD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'NZ', flag: '🇳🇿', name: 'New Zealand', nameVi: 'New Zealand',
    timezone: 'Pacific/Auckland', currency: 'USD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'BR', flag: '🇧🇷', name: 'Brazil', nameVi: 'Brazil',
    timezone: 'America/Sao_Paulo', currency: 'USD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1.234,56',
    numberSeparator: { decimal: ',', thousands: '.', decimals: 2 },
  },
  {
    code: 'MY', flag: '🇲🇾', name: 'Malaysia', nameVi: 'Malaysia',
    timezone: 'Asia/Singapore', currency: 'USD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'ID', flag: '🇮🇩', name: 'Indonesia', nameVi: 'Indonesia',
    timezone: 'Asia/Bangkok', currency: 'USD', language: 'en',
    dateFormat: 'DD/MM/YYYY', numberFormat: '1.234,56',
    numberSeparator: { decimal: ',', thousands: '.', decimals: 2 },
  },
  {
    code: 'PH', flag: '🇵🇭', name: 'Philippines', nameVi: 'Philippines',
    timezone: 'Asia/Singapore', currency: 'USD', language: 'en',
    dateFormat: 'MM/DD/YYYY', numberFormat: '1,234.56',
    numberSeparator: { decimal: '.', thousands: ',', decimals: 2 },
  },
  {
    code: 'NL', flag: '🇳🇱', name: 'Netherlands', nameVi: 'Hà Lan',
    timezone: 'Europe/Paris', currency: 'EUR', language: 'en',
    dateFormat: 'DD-MM-YYYY', numberFormat: '1.234,56',
    numberSeparator: { decimal: ',', thousands: '.', decimals: 2 },
  },
  {
    code: 'SE', flag: '🇸🇪', name: 'Sweden', nameVi: 'Thụy Điển',
    timezone: 'Europe/Paris', currency: 'EUR', language: 'en',
    dateFormat: 'YYYY-MM-DD', numberFormat: '1 234,56',
    numberSeparator: { decimal: ',', thousands: ' ', decimals: 2 },
  },
  {
    code: 'CH', flag: '🇨🇭', name: 'Switzerland', nameVi: 'Thụy Sĩ',
    timezone: 'Europe/Berlin', currency: 'EUR', language: 'en',
    dateFormat: 'DD.MM.YYYY', numberFormat: "1'234.56",
    numberSeparator: { decimal: '.', thousands: "'", decimals: 2 },
  },
];
