import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import * as sq from './locales/sq.json';
import * as en from './locales/en.json';

i18n
    // Detects language from localStorage, navigator, etc.
    .use(LanguageDetector)
    // Passes i18n down to React components
    .use(initReactI18next)
    .init({
        resources: {
            sq: { translation: sq },
            en: { translation: en }
        },
        lng: localStorage.getItem('i18nextLng') || 'sq', // Default to Albanian if no history
        fallbackLng: 'sq', // If a translation is missing in English, use Albanian
        interpolation: {
            escapeValue: false // React already handles escaping
        }
    });

export default i18n;