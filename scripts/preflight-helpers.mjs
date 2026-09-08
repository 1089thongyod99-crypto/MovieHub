#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [, , cmd, ...args] = process.argv;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function cmdManifest() {
  const p = readJson('./package.json');
  const declared = p.devDependencies?.vitest || p.dependencies?.vitest || 'NOT_DECLARED';
  console.log(`vitest_declared: ${declared}`);
}

function cmdLockfile() {
  if (!fs.existsSync('./package-lock.json')) {
    console.log('lockfile_present: NO');
    return;
  }
  const l = readJson('./package-lock.json');
  console.log('lockfile_present: YES');
  console.log(`lockfile_version: ${l.lockfileVersion}`);
  const root = l.packages?.[''] || {};
  console.log(`lockfile_root_name: ${root.name || 'UNKNOWN'}`);
}

function cmdFindVitest(expectedVersion) {
  const hits = new Set();

  function walk(dir, depth = 0) {
    if (depth > 5 || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name === '.bin') continue;
      const p = path.join(dir, name);
      let stat;
      try { stat = fs.statSync(p); } catch { continue; }
      if (!stat.isDirectory()) continue;

      if (name === 'vitest' && fs.existsSync(path.join(p, 'package.json'))) {
        try {
          const pkg = readJson(path.join(p, 'package.json'));
          hits.add(`${pkg.name}@${pkg.version} -> ${p}`);
        } catch { }
      }
      if (name.startsWith('@')) walk(p, depth + 1);
    }
  }

  walk('node_modules');

  if (!hits.size) {
    console.log('installed_vitest_found: NO');
    console.log('vitest_version_match: NO');
    return;
  }

  console.log('installed_vitest_found: YES');
  for (const x of [...hits].sort()) console.log(`vitest_hit: ${x}`);

  const anyMatches = expectedVersion
    ? [...hits].some(h => h.startsWith(`vitest@${expectedVersion} `))
    : true;
  console.log(`vitest_version_match: ${anyMatches ? 'YES' : 'NO'}`);
}

function cmdAuditSummary(jsonPath, label) {
  try {
    const a = readJson(jsonPath);
    const m = a.metadata?.vulnerabilities || {};
    const total = m.total ?? 0;
    console.log(`${label}_vulnerabilities: ${JSON.stringify(m)}`);
    console.log(`${label}_clean: ${total === 0 ? 'YES' : 'NO'}`);
  } catch (e) {
    console.log(`${label}_parse_failed: ${e.message}`);
    console.log(`${label}_clean: UNKNOWN`);
  }
}

switch (cmd) {
  case 'manifest': cmdManifest(); break;
  case 'lockfile': cmdLockfile(); break;
  case 'find-vitest': cmdFindVitest(args[0]); break;
  case 'audit-summary': cmdAuditSummary(args[0], args[1]); break;
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(2);
}
