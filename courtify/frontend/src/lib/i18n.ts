import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import vi from '../locales/vi.json';

const STORAGE_KEY = 'courtify_lang';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English (US)' },
  { code: 'vi', label: 'Tiếng Việt' },
] as const;

export type LangCode = 'en' | 'vi';

const savedLang = (localStorage.getItem(STORAGE_KEY) as LangCode) || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: LangCode) {
  i18n.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
}

export function getCurrentLanguage(): LangCode {
  return (i18n.language as LangCode) || 'en';
}

export default i18n;
