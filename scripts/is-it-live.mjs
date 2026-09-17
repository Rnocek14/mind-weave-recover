/**
 * Is what is in the repository the thing people are using?
 *
 * For a full day the answer was no and nothing made that visible. "Merged" and
 * "live" are different facts; the only way to tell them apart was to download a
 * bundle and grep it for a string that a fix had deleted. This asks the site.
 *
 *     node scripts/is-it-live.mjs
 *
 * Exits 0 when live matches the local HEAD, 1 when it is behind, so it can gate
 * anything that should not run against a stale site.
 */
import { execSync } from 'node:child_process';

const SITE = process.env.SITE_URL || 'https://neurospark.co';

const sh = (cmd) => {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
};

const head = sh('git rev-parse HEAD');
const headShort = head.slice(0, 7);

let live = null;
try {
  const res = await fetch(`${SITE}/version.json`, { cache: 'no-store' });
  if (res.ok) live = await res.json();
} catch { /* reported below */ }

if (!live) {
  console.log(`\n  live      : version.json not served yet`);
  console.log(`  local HEAD: ${headShort}`);
  console.log(`\n  The site predates the build stamp, so it is at least that old.`);
  console.log(`  PUBLISH NEEDED.\n`);
  process.exit(1);
}

const behind = live.commit === head ? 0 : Number(sh(`git rev-list --count ${live.commit}..HEAD`) || 'NaN');

console.log(`\n  live      : ${live.short}  ${live.subject || ''}`);
console.log(`              built ${live.builtAt}`);
console.log(`  local HEAD: ${headShort}`);

if (live.commit === head) {
  console.log(`\n  UP TO DATE — what is in the repo is what people are using.\n`);
  process.exit(0);
}

if (Number.isNaN(behind)) {
  console.log(`\n  The live commit is not in this clone (fetch, or it is from another branch).`);
  console.log(`  PUBLISH NEEDED.\n`);
  process.exit(1);
}

console.log(`\n  BEHIND BY ${behind} COMMIT${behind === 1 ? '' : 'S'} — PUBLISH NEEDED.`);
console.log(sh(`git log --oneline ${live.commit}..HEAD`).split('\n').map((l) => `    ${l}`).join('\n'));
console.log('');
process.exit(1);
