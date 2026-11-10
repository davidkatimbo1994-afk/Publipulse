import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
}

/** Yields the full opening tag of every <button> / <Button>, tracking {braces} and quotes so `=>` inside handlers is not mistaken for the tag end. */
function* buttonTags(src) {
  for (const m of src.matchAll(/<(button|Button)\b/g)) {
    let i = m.index + m[0].length, depth = 0, quote = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === quote) quote = null; }
      else if ('"\'`'.includes(c)) quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    yield { index: m.index, tag: src.slice(m.index, i + 1) };
  }
}

// App.legacy.tsx is the retired monolith (not mounted); its only handler-less button is a form submit.
const files = ['apps/web/src', 'apps/field/src']
  .flatMap((d) => walk(join(root, d)))
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('App.legacy.tsx'));

test('every button has a click handler, is a form submit, or forwards props', () => {
  const dead = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const { index, tag } of buttonTags(src)) {
      if (/onClick=|type="submit"|\{\.\.\.rest\}|\{\.\.\.props\}/.test(tag)) continue;
      const line = src.slice(0, index).split('\n').length;
      dead.push(`${relative(root, file)}:${line}`);
    }
  }
  assert.deepEqual(dead, [], `buttons with no handler: ${dead.join(', ')}`);
});

test('the scanner itself notices a handler-less button', () => {
  const found = [...buttonTags('<div><button type="button" className="x">Go</button><Button onClick={() => go()}>ok</Button></div>')];
  assert.equal(found.length, 2);
  assert.ok(!/onClick=/.test(found[0].tag));
  assert.ok(/onClick=/.test(found[1].tag));
});
