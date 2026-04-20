#!/bin/bash
# Pre-Commit Check - Run before every commit
# Usage: bash scripts/pre-commit-check.sh

echo "=== PRE-COMMIT CHECK ==="
FAILED=0

# 1. Secret scan
echo ""
echo "[1/4] Secret scan..."
bash scripts/secret-scan.sh
[ $? -ne 0 ] && FAILED=1

# 2. Build check
echo ""
echo "[2/4] Build check..."
npm run build --silent 2>/dev/null
if [ $? -ne 0 ]; then
  echo "  FAIL: Build failed"
  FAILED=1
else
  echo "  PASS: Build successful"
fi

# 3. Debug code check
echo ""
echo "[3/4] Debug code check..."
STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E "\.(ts|tsx)$")
if [ -n "$STAGED" ]; then
  DEBUG_FOUND=$(echo "$STAGED" | xargs grep -nE "debugger|console\.log\(.*DEBUG|// TODO.*HACK|// FIXME" 2>/dev/null)
  if [ -n "$DEBUG_FOUND" ]; then
    echo "  WARN: Debug markers in staged files:"
    echo "$DEBUG_FOUND" | head -5 | sed 's/^/    /'
    FAILED=1
  else
    echo "  PASS: No debug markers"
  fi
else
  echo "  SKIP: No staged .ts/.tsx files"
fi

# 4. Type check for 'any'
echo ""
echo "[4/4] Type safety check..."
if [ -n "$STAGED" ]; then
  ANY_TYPES=$(echo "$STAGED" | xargs grep -nE ": any[^A-Za-z]|as any[^A-Za-z]" 2>/dev/null | grep -v "// eslint-disable")
  if [ -n "$ANY_TYPES" ]; then
    echo "  WARN: 'any' types in staged files:"
    echo "$ANY_TYPES" | head -5 | sed 's/^/    /'
  else
    echo "  PASS: No untyped 'any' found"
  fi
else
  echo "  SKIP: No staged .ts/.tsx files"
fi

echo ""
if [ $FAILED -ne 0 ]; then
  echo "=== PRE-COMMIT: FAILED - Fix issues above ==="
else
  echo "=== PRE-COMMIT: PASSED ==="
fi

exit $FAILED
