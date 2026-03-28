/// <reference types="@angular/localize" />

import { ApplicationRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { loadTranslations } from '@angular/localize';
import { createCustomElement } from '@angular/elements';
import { PostInsertComponent } from './app/components/post-insert/post-insert.component';
import { SpoilerBoxComponent } from './app/components/spoiler-box/spoiler-box.component';

const storedLocale = localStorage.getItem('locale');

function detectGuestLocale(): string | null {
  const languages: readonly string[] = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some(l => l.startsWith('ru')) ? 'ru-RU' : null;
}

const locale = storedLocale ?? detectGuestLocale();

function registerCustomElements(appRef: ApplicationRef): void {
  const PostInsertElement = createCustomElement(PostInsertComponent, { injector: appRef.injector });
  customElements.define('post-insert', PostInsertElement);

  const SpoilerBoxElement = createCustomElement(SpoilerBoxComponent, { injector: appRef.injector });
  customElements.define('spoiler-box', SpoilerBoxElement);
}

if (locale === 'ru-RU') {
  import('./locale/ru').then(module => {
    loadTranslations(module.TRANSLATIONS_RU);
    bootstrapApplication(AppComponent, appConfig)
      .then(registerCustomElements)
      .catch((err) => console.error(err));
  });
} else {
  bootstrapApplication(AppComponent, appConfig)
    .then(registerCustomElements)
    .catch((err) => console.error(err));
}
