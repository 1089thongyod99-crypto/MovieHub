#!/usr/bin/env bash
set -u

EXPECTED_VITEST_VERSION="4.1.11"
HELPER="scripts/preflight-helpers.mjs"

echo '=== MOVIEHUB R14-C PRE-PUSH FORENSIC CHECK ==='
echo

echo '--- 1) TOOLCHAIN ---'
node -v
npm -v
echo

echo '--- 2) PACKAGE MANIFEST ---'
if test -f package.json; then
  echo 'package.json: PRESENT'
  node "$HELPER" manifest
else
  echo 'package.json: MISSING'
fi
echo

echo '--- 3) LOCKFILE ---'
node "$HELPER" lockfile
echo

echo '--- 4) ACTUAL VITEST TREE (whole-tree sanity) ---'
npm ls vitest --all
VITEST_LS_RC=$?
echo "npm ls vitest exit: $VITEST_LS_RC"
echo "(non-zero here can mean unrelated unmet peer deps elsewhere in the tree —"
echo " it does not by itself mean vitest failed to install. See step 5 for that.)"
echo

echo '--- 5) INSTALLED VITEST VERSION CHECK ---'
FIND_VITEST_OUT=$(node "$HELPER" find-vitest "$EXPECTED_VITEST_VERSION")
echo "$FIND_VITEST_OUT"
VITEST_VERSION_MATCH=$(echo "$FIND_VITEST_OUT" | grep '^vitest_version_match:' | awk '{print $2}')
echo "expected version: $EXPECTED_VITEST_VERSION"
echo "version match: ${VITEST_VERSION_MATCH:-NO}"
echo

echo '--- 6) GITIGNORE ---'
if test -f .gitignore; then
  echo '.gitignore: PRESENT'
  grep -nE '(^|/)(node_modules|dist|coverage|playwright-report|test-results)(/|$)' .gitignore || echo '(no relevant ignore rules found)'
else
  echo '.gitignore: MISSING'
fi
echo

echo '--- 7) NODE_MODULES TRACKING ---'
if git ls-files --error-unmatch node_modules >/dev/null 2>&1; then
  echo 'ERROR: node_modules itself is tracked'
else
  echo 'node_modules root: NOT_TRACKED'
fi

NODE_TRACKED_COUNT=$(git ls-files 'node_modules/**' | wc -l | tr -d ' ')
echo "tracked files under node_modules: $NODE_TRACKED_COUNT"
echo

echo '--- 8) WORKTREE ---'
git status --short
echo

echo '--- 9) UNTRACKED SOURCE FILES ---'
git status --short --untracked-files=all | grep '^?? ' | sed 's/^?? //' | head -200
echo

echo '--- 10) AUDIT: PRODUCTION ONLY ---'
npm audit --omit=dev --json > /tmp/moviehub-audit-prod.json
AUDIT_RC=$?
echo "npm audit --omit=dev exit: $AUDIT_RC"
AUDIT_PROD_OUT=$(node "$HELPER" audit-summary /tmp/moviehub-audit-prod.json production)
echo "$AUDIT_PROD_OUT"
AUDIT_PROD_CLEAN=$(echo "$AUDIT_PROD_OUT" | grep '^production_clean:' | awk '{print $2}')
echo

echo '--- 11) AUDIT: FULL TREE (informational) ---'
npm audit --json > /tmp/moviehub-audit-full.json
FULL_AUDIT_RC=$?
echo "npm audit full exit: $FULL_AUDIT_RC"
node "$HELPER" audit-summary /tmp/moviehub-audit-full.json full
echo

echo '=== DECISION ==='

if [ "${VITEST_VERSION_MATCH:-NO}" != "YES" ]; then
  echo "HOLD: vitest@$EXPECTED_VITEST_VERSION not found installed"
elif [ "$NODE_TRACKED_COUNT" -ne 0 ]; then
  echo 'HOLD: node_modules contains tracked files'
elif [ "${AUDIT_PROD_CLEAN:-NO}" != "YES" ]; then
  echo 'HOLD: production audit is NOT clean'
else
  echo 'PRODUCTION DEPENDENCY GATE: PASS'
  echo 'NOTE: full-tree audit result (step 11) must still be reviewed separately'
fi

echo
echo '=== NO COMMIT / NO PUSH WAS PERFORMED ==='
