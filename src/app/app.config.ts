import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { authInterceptor } from './auth.interceptor';
import { LOCALES, DEFAULT_LOCALE } from '../locale_config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    {
      provide: LOCALE_ID,
      useFactory: () => {
        const stored = localStorage.getItem('locale');
        return LOCALES.find(d => d.code === stored)?.code ?? DEFAULT_LOCALE;
      }
    }
  ]
};
