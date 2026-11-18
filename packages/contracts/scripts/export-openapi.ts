// Exporte le document OpenAPI dans `dist/openapi.json` (utilisé par le front et le portage Rust).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOpenApiDocument } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', 'dist', 'openapi.json');

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`, 'utf8');

console.log(`OpenAPI exporté : ${target}`);
