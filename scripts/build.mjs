/**
 * Build script for Oxford Popup (TypeScript migration).
 * Run with: npm run build
 * 
 * Steps:
 *   1. Type-check via tsc --noEmit (fail on errors)
 *   2. Bundle src/background/main.ts, src/content/main.ts, src/options.js with esbuild
 *   3. Copy static assets (manifest.json, content.css, options.html, README.md, icons/) to dist/
 *   4. Zip dist/ contents into dist/oxford-popup-ts.zip
 */

import { build } from 'esbuild';
import { cp, rm, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

async function main() {
  // Step a: tsc --noEmit via child_process
  console.log('Type-checking...');
  try {
    execSync('npx tsc --noEmit', { cwd: root, stdio: 'inherit' });
  } catch (err) {
    console.error('Type-check failed');
    process.exit(1);
  }

  // Clean and create dist
  if (existsSync(dist)) {
    await rm(dist, { recursive: true, force: true });
  }
  await mkdir(dist, { recursive: true });

  // Step b: esbuild bundles
  console.log('Bundling...');
  const entries = [
    { in: 'src/background/main.ts', out: 'background.js' },
    { in: 'src/content/main.ts', out: 'content.js' },
    { in: 'src/options.js', out: 'options.js' }
  ];

  for (const entry of entries) {
    await build({
      entryPoints: [join(root, entry.in)],
      outfile: join(dist, entry.out),
      bundle: true,
      format: 'iife',
      minify: false,
      sourcemap: false,
      target: 'es2022',
      platform: 'browser'
    });
    console.log(`  ${entry.in} -> ${entry.out}`);
  }

  // Step c: copy static assets
  console.log('Copying static assets...');
  const staticAssets = [
    'manifest.json',
    'content.css',
    'options.html',
    'README.md'
  ];

  for (const asset of staticAssets) {
    const srcPath = join(root, asset);
    if (existsSync(srcPath)) {
      await cp(srcPath, join(dist, asset), { force: true });
      console.log(`  ${asset}`);
    }
  }

  // Copy icons/ directory recursively
  const iconsSrc = join(root, 'icons');
  const iconsDest = join(dist, 'icons');
  if (existsSync(iconsSrc)) {
    await cp(iconsSrc, iconsDest, { recursive: true, force: true });
    console.log('  icons/');
  }

  // Step d: zip ONLY the dist contents at zip root
  console.log('Creating zip...');
  const zipPath = join(dist, 'oxford-popup-ts.zip');
  
  // cd into dist and zip the contents
  const filesToZip = [
    'manifest.json',
    'background.js',
    'content.js',
    'content.css',
    'options.html',
    'options.js',
    'README.md'
  ];
  
  // Also include icons directory
  const zipArgs = ['-r', zipPath];
  for (const f of filesToZip) {
    if (existsSync(join(dist, f))) {
      zipArgs.push(f);
    }
  }
  if (existsSync(iconsDest)) {
    zipArgs.push('icons');
  }
  
  execSync('zip ' + zipArgs.join(' '), { cwd: dist, stdio: 'inherit' });
  console.log(`  Created ${zipPath}`);

  console.log('Build complete.');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
