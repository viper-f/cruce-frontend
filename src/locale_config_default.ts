export interface LocaleDefinition {
  code: string;
  langPrefixes: string[];
  translations: () => Promise<Record<string, string>>;
  angularLocale: () => Promise<any>;
}

export const LOCALES: LocaleDefinition[] = [
  {
    code: 'ru-RU',
    langPrefixes: ['ru'],
    translations: () => import('./locale/ru').then(m => m.TRANSLATIONS_RU),
    angularLocale: () => import('@angular/common/locales/ru'),
  },
];

export const DEFAULT_LOCALE = 'en-CA';
