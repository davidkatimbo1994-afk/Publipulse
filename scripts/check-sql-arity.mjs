// Static SQL arity guard. For every `INSERT INTO t (cols) VALUES(...)` in API source:
//   columns == placeholders (excluding literals/now()) and, when a params array follows
//   directly, highest $n == params passed. Catches "more target columns than expressions"
//   class bugs that text-matching tests cannot see. Dependency-free; runs in CI and locally.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const srcDir = join(root, 'apps/api/src');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : []);
}
function splitTop(s) {
  const out = []; let depth = 0, cur = '', q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function balanced(s, openIdx) { // returns index of matching close paren
  let depth = 0, q = null;
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === "'") { q = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

export function checkSource(file, text) {
  const problems = []; let checked = 0;
  const re = /INSERT\s+INTO\s+([a-z_]+)\s*\(/gi;
  let m;
  while ((m = re.exec(text))) {
    const open = m.index + m[0].length - 1;
    const close = balanced(text, open);
    if (close < 0) continue;
    const cols = splitTop(text.slice(open + 1, close));
    const rest = text.slice(close + 1);
    const v = /^\s*VALUES\s*\(/i.exec(rest);
    if (!v) continue; // INSERT ... SELECT: not checked here
    const vOpen = close + 1 + v[0].length - 1;
    const vClose = balanced(text, vOpen);
    if (vClose < 0) continue;
    const exprs = splitTop(text.slice(vOpen + 1, vClose));
    checked++;
    const line = text.slice(0, m.index).split('\n').length;
    if (cols.length !== exprs.length)
      problems.push(`${file}:${line} INSERT INTO ${m[1]} has ${cols.length} columns but ${exprs.length} VALUES expressions`);
    const maxParam = Math.max(0, ...[...text.slice(vOpen, vClose).matchAll(/\$(\d+)/g)].map((x) => Number(x[1])));
    // params array: first `[` after the SQL string terminator
    const after = text.slice(vClose);
    const tail = after.match(/[`'"]\s*,\s*\[/);
    if (tail) {
      const aOpen = vClose + tail.index + tail[0].length - 1;
      let depth = 0, end = -1, q = null;
      for (let i = aOpen; i < text.length; i++) {
        const ch = text[i];
        if (q) { if (ch === q) q = null; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
        if ('([{'.includes(ch)) depth++;
        if (')]}'.includes(ch)) { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end > 0) {
        const params = splitTop(text.slice(aOpen + 1, end));
        if (params.length !== maxParam)
          problems.push(`${file}:${line} INSERT INTO ${m[1]} references $${maxParam} but passes ${params.length} parameters`);
      }
    }
  }
  return { problems, checked };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let total = 0; const all = [];
  for (const f of walk(srcDir)) {
    const r = checkSource(f.replace(root, ''), readFileSync(f, 'utf8'));
    total += r.checked; all.push(...r.problems);
  }
  if (all.length) { console.error(all.join('\n')); console.error(`\nSQL arity check FAILED (${all.length} problem(s), ${total} INSERTs checked)`); process.exit(1); }
  console.log(`SQL arity check passed (${total} INSERT statements checked)`);
}
