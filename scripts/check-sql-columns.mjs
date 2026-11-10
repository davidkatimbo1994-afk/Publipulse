// Schema-aware SQL guard. Builds the table/column map from apps/api/migrations/*.sql and checks that
// every `INSERT INTO t (cols)` and `UPDATE t SET col=` in API source names a real table and real columns.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const stripSqlComments = (s) => s.replace(/--[^\n]*/g, '');

function splitTop(s) {
  const out = []; let depth = 0, cur = '', q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const CONSTRAINT_START = /^(constraint|primary|foreign|unique|check|exclude|like)\b/i;

export function buildSchema(migrationDir = join(root, 'apps/api/migrations')) {
  const tables = new Map();
  const files = readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = stripSqlComments(readFileSync(join(migrationDir, f), 'utf8'));
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s*\(/gi)) {
      let depth = 0, i = m.index + m[0].length - 1, end = -1;
      for (; i < sql.length; i++) { if (sql[i] === '(') depth++; if (sql[i] === ')') { depth--; if (!depth) { end = i; break; } } }
      const cols = new Set();
      for (const item of splitTop(sql.slice(m.index + m[0].length, end))) {
        if (CONSTRAINT_START.test(item)) continue;
        const name = /^"?([a-z_0-9]+)"?/i.exec(item)?.[1]; if (name) cols.add(name.toLowerCase());
      }
      tables.set(m[1].toLowerCase(), cols);
    }
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s+([^;]*);/gi)) {
      const t = m[1].toLowerCase(); const cols = tables.get(t) ?? new Set();
      for (const part of splitTop(m[2])) {
        const add = /^ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_0-9]+)"?/i.exec(part); if (add) cols.add(add[1].toLowerCase());
        const drop = /^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?([a-z_0-9]+)"?/i.exec(part); if (drop) cols.delete(drop[1].toLowerCase());
        const ren = /^RENAME\s+COLUMN\s+"?([a-z_0-9]+)"?\s+TO\s+"?([a-z_0-9]+)"?/i.exec(part); if (ren) { cols.delete(ren[1].toLowerCase()); cols.add(ren[2].toLowerCase()); }
      }
      if (tables.has(t)) tables.set(t, cols);
    }
  }
  return tables;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : []);
}

export function checkSource(file, text, tables) {
  const problems = []; let checked = 0;
  const lineOf = (i) => text.slice(0, i).split('\n').length;
  for (const m of text.matchAll(/INSERT\s+INTO\s+([a-z_0-9]+)\s*\(([^)]*)\)/gi)) {
    const t = m[1].toLowerCase(); checked++;
    if (!tables.has(t)) { problems.push(`${file}:${lineOf(m.index)} INSERT INTO unknown table "${t}"`); continue; }
    for (const c of m[2].split(',').map((x) => x.trim().replace(/"/g, '').toLowerCase()).filter(Boolean))
      if (!tables.get(t).has(c)) problems.push(`${file}:${lineOf(m.index)} INSERT INTO ${t}: no such column "${c}"`);
  }
  for (const m of text.matchAll(/UPDATE\s+([a-z_0-9]+)\s+SET\s+([^`'"]*?)(?:\s+WHERE\b|\s+RETURNING\b|[`'"])/gi)) {
    const t = m[1].toLowerCase();
    if (!tables.has(t)) continue; checked++;
    for (const part of splitTop(m[2])) {
      const c = /^"?([a-z_0-9]+)"?\s*=/i.exec(part)?.[1]?.toLowerCase();
      if (c && !tables.get(t).has(c)) problems.push(`${file}:${lineOf(m.index)} UPDATE ${t}: no such column "${c}"`);
    }
  }
  return { problems, checked };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tables = buildSchema(); let total = 0; const all = [];
  for (const f of walk(join(root, 'apps/api/src'))) {
    const r = checkSource(f.replace(root, ''), readFileSync(f, 'utf8'), tables); total += r.checked; all.push(...r.problems);
  }
  if (all.length) { console.error(all.join('\n')); console.error(`\nSQL column check FAILED (${all.length} problem(s), ${total} statements, ${tables.size} tables)`); process.exit(1); }
  console.log(`SQL column check passed (${total} statements checked against ${tables.size} migrated tables)`);
}
