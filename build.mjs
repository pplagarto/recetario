import { mkdir, copyFile, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteConfig } from './config.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = path.join(root, 'dist');
// Explicit allowlist: source tooling, screenshots and preview pages never ship.
const files = [
  'index.html', 'app.js', 'calculations.js', 'styles.css', 'themes.css', 'pantry.js', 'pantry.css',
  'assets/brownies.svg', 'assets/burritos.svg', 'assets/caldo.svg', 'assets/icon.svg',
  'data/recipes.js', 'data/recetario-original.md', '_headers'
];
await rm(out, { recursive: true, force: true });
for (const file of files) {
  const target = path.join(out, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
await writeFile(path.join(out, 'config.js'), `export const siteConfig = ${JSON.stringify({ ...siteConfig, enableStylePreview: false }, null, 2)};\n`);
const total = (await Promise.all([...files, 'config.js'].map(async file => (await readFile(path.join(out, file))).byteLength))).reduce((sum, size) => sum + size, 0);
console.log(`Publicación preparada: ${files.length + 1} archivos, ${(total / 1024).toFixed(1)} KiB. Tema ${siteConfig.theme}, sin selector de pruebas.`);
console.log(out);
