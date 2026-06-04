// BigBike QA — live black-box runner. Runs against the RUNNING docker stack.
// Usage: node qa-tests/live/run.mjs [suiteName ...]   (no args = all)
import { writeReport, getResults, BACKEND } from './lib/harness.mjs';

const ALL = {
  'auth-permission': () => import('./auth-permission.test.mjs'),
  'config-env': () => import('./config-env.test.mjs'),
  'commerce-risk': () => import('./commerce-risk.test.mjs'),
  'fulfillment': () => import('./fulfillment.test.mjs'),
  'returns': () => import('./returns.test.mjs'),
};

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(ALL);

console.log(`\n# BigBike live QA — backend=${BACKEND}\n`);
for (const name of names) {
  const loader = ALL[name];
  if (!loader) { console.log(`(skip unknown suite "${name}")`); continue; }
  console.log(`\n## ${name}`);
  try {
    const mod = await loader();
    await mod.default();
  } catch (e) {
    console.log(`  !! suite "${name}" crashed: ${e.message}`);
  }
}

const summary = writeReport('qa-tests/.artifacts/live-results.json');
const failed = getResults().filter((r) => r.status === 'FAIL').length;
process.exit(failed > 0 ? 1 : 0);
