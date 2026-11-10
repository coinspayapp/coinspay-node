import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.json')], {
  stdio: 'inherit',
});

const cjs = createRequire(import.meta.url)(join(dist, 'cjs', 'index.js'));
const names = Object.keys(cjs).filter((name) => name !== '__esModule').sort();

mkdirSync(join(dist, 'esm'), { recursive: true });
writeFileSync(join(dist, 'esm', 'index.mjs'), `import cjs from '../cjs/index.js';\n\nexport const {\n${names.map((name) => `  ${name},\n`).join('')}} = cjs;\n`);
writeFileSync(join(dist, 'esm', 'index.d.mts'), "export * from '../cjs/index.js';\n");
console.log(`dist: CJS and ESM, ${names.length} exports`);
