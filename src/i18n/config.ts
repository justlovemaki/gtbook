import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import zhTranslations from './locales/zh.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      zh: {
        translation: zhTranslations,
      },
    },
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'cookie'], // 移除 navigator，确保首次访问不随浏览器
      caches: ['localStorage'],
    },
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
