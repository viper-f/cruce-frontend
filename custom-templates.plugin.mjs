/**
 * Applies custom HTML template overrides, runs ng build, then restores originals.
 * Usage: node custom-templates.plugin.mjs [ng build args...]
 *
 * Reads src/environments/custom_templates.json if it exists.
 * If the file is absent, builds normally with no overrides.
 */

import { existsSync, copyFileSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// Substitute New Relic env vars into index.html
const indexPath = resolve(__dirname, 'src/index.html');
const originalIndex = readFileSync(indexPath, 'utf-8');
const nrTokens = {
  '%%NR_LICENSE_KEY%%': process.env.NR_LICENSE_KEY || '',
  '%%NR_APP_ID%%': process.env.NR_APP_ID || '',
  '%%NR_ACCOUNT_ID%%': process.env.NR_ACCOUNT_ID || '',
};
const missingNrVars = Object.entries(nrTokens).filter(([, v]) => !v).map(([k]) => k);
if (missingNrVars.length) console.warn(`[build] Warning: NR env vars not set, tokens left empty: ${missingNrVars.join(', ')}`);
let indexContent = originalIndex;
for (const [token, value] of Object.entries(nrTokens)) {
  indexContent = indexContent.replaceAll(token, value);
}
writeFileSync(indexPath, indexContent);
console.log('[build] New Relic tokens substituted in index.html');

// Run ng build, passing through any extra args (e.g. --configuration production)
const ngArgs = process.argv.slice(2).join(' ');
let exitCode = 0;
try {
  execSync(`npx ng build ${ngArgs}`, { stdio: 'inherit' });
} catch {
  exitCode = 1;
} finally {
  // Always restore originals
  writeFileSync(indexPath, originalIndex);
  console.log('[build] index.html restored.');
  for (const { defaultPath, backupPath } of applied) {
    copyFileSync(backupPath, defaultPath);
    unlinkSync(backupPath);
  }
  if (applied.length) console.log('[build] Original templates restored.');
}

process.exit(exitCode);
