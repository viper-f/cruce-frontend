/// <reference types="@angular/localize" />

import { ApplicationRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { loadTranslations } from '@angular/localize';
import { registerLocaleData } from '@angular/common';
import { createCustomElement } from '@angular/elements';
import { PostInsertComponent } from './app/components/post-insert/post-insert.component';
import { SpoilerBoxComponent } from './app/components/spoiler-box/spoiler-box.component';
import { LOCALES } from './locale_config';

function detectGuestLocale(): string | null {
  const languages: readonly string[] = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const def of LOCALES) {
    if (languages.some(l => def.langPrefixes.some(p => l.startsWith(p)))) return def.code;
  }
  return null;
}

const storedLocale = localStorage.getItem('locale');
const locale = storedLocale ?? detectGuestLocale();
const locDef = LOCALES.find(d => d.code === locale);

function registerCustomElements(appRef: ApplicationRef): void {
  const PostInsertElement = createCustomElement(PostInsertComponent, { injector: appRef.injector });
  customElements.define('post-insert', PostInsertElement);

  const SpoilerBoxElement = createCustomElement(SpoilerBoxComponent, { injector: appRef.injector });
  customElements.define('spoiler-box', SpoilerBoxElement);
}

async function bootstrap(): Promise<void> {
  if (locDef) {
    const [translations, angularLocaleModule] = await Promise.all([
      locDef.translations(),
      locDef.angularLocale?.(),
    ]);
    if (angularLocaleModule) registerLocaleData(angularLocaleModule.default);
    loadTranslations(translations);
  }
  await bootstrapApplication(AppComponent, appConfig).then(registerCustomElements);
}

bootstrap().catch(err => console.error(err));
