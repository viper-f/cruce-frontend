export interface LocaleDefinition {
  code: string;
  langPrefixes: string[];
  translations: () => Promise<Record<string, string>>;
  angularLocale?: () => Promise<any>;
}

export const LOCALES: LocaleDefinition[] = [
  {
    code: 'ru-RU',
    langPrefixes: ['ru'],
    translations: () => import('./locale/ru').then(m => m.TRANSLATIONS_RU),
    angularLocale: () => import('@angular/common/locales/ru'),
  },
  {
    code: 'ch-CH',
    langPrefixes: ['ch'],
    translations: () => import('./locale/ch').then(m => m.TRANSLATIONS_CH),
  },
];

export const DEFAULT_LOCALE = 'en-CA';
