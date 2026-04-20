#!/bin/bash
# Project Health Check - Quick overview of project state
# Usage: bash scripts/health-check.sh

echo "=== CREATORHUB HEALTH CHECK ==="
echo ""

# 1. Git status
echo "--- Git ---"
BRANCH=$(git branch --show-current 2>/dev/null)
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
echo "  Branch: $BRANCH"
echo "  Uncommitted changes: $UNCOMMITTED"

# 2. Build
echo ""
echo "--- Build ---"
npm run build --silent 2>/dev/null
if [ $? -eq 0 ]; then
  echo "  Build: PASS"
else
  echo "  Build: FAIL"
fi

# 3. Code stats
echo ""
echo "--- Code Stats ---"
TS_FILES=$(find app/ lib/ components/ store/ -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
API_ROUTES=$(find app/api -name "route.ts" 2>/dev/null | wc -l)
COMPONENTS=$(find components/ -name "*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
STORES=$(find store/ -name "*.ts" 2>/dev/null | grep -v node_modules | wc -l)
E2E_TESTS=$(find e2e/ -name "*.spec.ts" 2>/dev/null | wc -l)
echo "  TypeScript files: $TS_FILES"
echo "  API routes: $API_ROUTES"
echo "  Components: $COMPONENTS"
echo "  Zustand stores: $STORES"
echo "  E2E test files: $E2E_TESTS"

# 4. Quality indicators
echo ""
echo "--- Quality ---"
TODOS=$(grep -r "TODO\|FIXME\|HACK\|XXX" app/ lib/ components/ store/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
CONSOLE_LOGS=$(grep -r "console\.log" app/ lib/ components/ store/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
ANY_TYPES=$(grep -rE ": any[^A-Za-z]|as any[^A-Za-z]" app/ lib/ components/ store/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
echo "  TODOs/FIXMEs: $TODOS"
echo "  console.log: $CONSOLE_LOGS"
echo "  'any' types: $ANY_TYPES"

# 5. Security quick check
echo ""
echo "--- Security Quick Check ---"
UNPROTECTED=0
for f in $(find app/api -name "route.ts" 2>/dev/null); do
  if ! grep -qE "withApiProtection|withAuthOnly|requireAuth" "$f"; then
    if [[ "$f" != *"auth/callback"* ]]; then
      UNPROTECTED=$((UNPROTECTED + 1))
    fi
  fi
done
echo "  Unprotected API routes: $UNPROTECTED"

echo ""
echo "=== DONE ==="
