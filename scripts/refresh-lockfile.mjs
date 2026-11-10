// Regenerates package-lock.json for every workspace (including apps/field) and rewrites package-lock.sha256.
// Needs network access to registry.npmjs.org. Usage: npm run lockfile:refresh
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n${cmd} ${args.join(' ')} failed. This script needs access to registry.npmjs.org.`);
    process.exit(r.status ?? 1);
  }
};

run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--registry=https://registry.npmjs.org/']);
const digest = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
writeFileSync('package-lock.sha256', `${digest}  package-lock.json\n`);
console.log(`package-lock.sha256 updated (${digest.slice(0, 12)}…). Running verification…`);
run('node', ['scripts/verify-lockfile.mjs']);
console.log('Lockfile verified. Commit package-lock.json and package-lock.sha256 together.');
