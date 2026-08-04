import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeRu from '@angular/common/locales/ru';
import { authInterceptor } from './auth.interceptor';
import { errorLoggingInterceptor } from './error-logging.interceptor';

registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor, errorLoggingInterceptor])),
    provideAnimations(),
    {
      provide: LOCALE_ID,
      useFactory: () => {
        const storedLocale = localStorage.getItem('locale');
        return storedLocale === 'ru-RU' ? 'ru-RU' : 'en-CA';
      }
    }
  ]
};
