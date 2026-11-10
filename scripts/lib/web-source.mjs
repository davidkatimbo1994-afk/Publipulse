import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = fileURLToPath(new URL('../../apps/web/src/', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Concatenated text of every .ts/.tsx file under apps/web/src, so source-contract tests survive file splits. */
export function readWebSource() {
  return walk(webSrc)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'))
    .sort()
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}
