/**
 * Applies custom HTML template overrides, runs ng build, then restores originals.
 * Usage: node custom-templates.plugin.mjs [ng build args...]
 *
 * Reads src/environments/custom_templates.json if it exists.
 * If the file is absent, builds normally with no overrides.
 */

import { existsSync, copyFileSync, unlinkSync } from 'fs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Bootstrap locale_config.ts from the default if not present
const localeConfig        = resolve(__dirname, 'src/locale_config.ts');
const localeConfigDefault = resolve(__dirname, 'src/locale_config_default.ts');
if (!existsSync(localeConfig) && existsSync(localeConfigDefault)) {
  copyFileSync(localeConfigDefault, localeConfig);
  console.log('[build] locale_config.ts not found — copied from locale_config_default.ts');
}

const jsonPath = resolve(__dirname, 'src/environments/custom_templates.json');
const templates = existsSync(jsonPath)
  ? JSON.parse(readFileSync(jsonPath, 'utf-8'))
  : [];

// Apply overrides: copy custom file over default, keeping a .bak of the original
const applied = [];
for (const { default_template, template } of templates) {
  const defaultPath = resolve(__dirname, default_template);
  const customPath  = resolve(__dirname, template);
  const backupPath  = defaultPath + '.bak';

  if (!existsSync(defaultPath)) { console.warn(`[build] Missing default template: ${default_template}`); continue; }
  if (!existsSync(customPath))  { console.warn(`[build] Missing custom template: ${template}`); continue; }

  copyFileSync(defaultPath, backupPath);
  copyFileSync(customPath, defaultPath);
  applied.push({ defaultPath, backupPath });
  console.log(`[build] Applied: ${template} → ${default_template}`);
}

// Run ng build, passing through any extra args (e.g. --configuration production)
const ngArgs = process.argv.slice(2).join(' ');
let exitCode = 0;
try {
  execSync(`ng build ${ngArgs}`, { stdio: 'inherit' });
} catch {
  exitCode = 1;
} finally {
  // Always restore originals
  for (const { defaultPath, backupPath } of applied) {
    copyFileSync(backupPath, defaultPath);
    unlinkSync(backupPath);
  }
  if (applied.length) console.log('[build] Original templates restored.');
}

process.exit(exitCode);
