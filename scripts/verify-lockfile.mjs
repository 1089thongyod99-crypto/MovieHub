import fs from 'node:fs';

const lockPath = 'package-lock.json';

if (!fs.existsSync(lockPath)) {
  console.error('FAIL: package-lock.json not found');
  process.exit(1);
}

let lock;
try {
  lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
} catch (error) {
  console.error(`FAIL: invalid package-lock.json: ${error.message}`);
  process.exit(1);
}

if (!lock.lockfileVersion || lock.lockfileVersion < 2) {
  console.error(`FAIL: invalid lockfileVersion: ${lock.lockfileVersion}`);
  process.exit(1);
}

if (!lock.name || !lock.version) {
  console.error('FAIL: package name/version missing in lockfile');
  process.exit(1);
}

let bad = 0;

for (const [name, pkg] of Object.entries(lock.packages ?? {})) {
  if (name === '') continue;

  if (pkg.resolved && !pkg.resolved.startsWith('https://')) {
    console.error(`FAIL: ${name} resolved URL is not HTTPS: ${pkg.resolved}`);
    bad++;
  }

  if (pkg.version && !pkg.link && !pkg.integrity) {
    console.error(`FAIL: ${name} missing integrity`);
    bad++;
  }
}

if (bad > 0) {
  process.exit(1);
}

console.log('PASS: lockfile validation OK');
console.log(
  `INFO: ${Object.keys(lock.packages ?? {}).length} packages, lockfileVersion ${lock.lockfileVersion}`
);
