export interface LocaleDefinition {
  code: string;
  langPrefixes: string[];
  translations: () => Promise<Record<string, string>>;
  angularLocale?: string;
}

export const LOCALES: LocaleDefinition[] = [
  {
    code: 'ru-RU',
    langPrefixes: ['ru'],
    translations: () => import('./locale/ru').then(m => m.TRANSLATIONS_RU),
    angularLocale: 'ru',
  },
];

export const DEFAULT_LOCALE = 'en-CA';
