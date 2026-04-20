#!/bin/bash
# Security Scan - Check for common vulnerabilities
# Usage: bash scripts/security-scan.sh

echo "=== SECURITY SCAN ==="
ISSUES=0

echo ""
echo "--- 1. Unprotected API Routes ---"
# Find API routes without auth protection
for f in $(find app/api -name "route.ts" 2>/dev/null); do
  if ! grep -qE "withApiProtection|withAuthOnly|requireAuth" "$f"; then
    # Skip auth callback routes (they're meant to be public)
    if [[ "$f" != *"auth/callback"* ]]; then
      echo "  WARN: $f - no auth protection found"
      ISSUES=$((ISSUES + 1))
    fi
  fi
done
[ $ISSUES -eq 0 ] && echo "  PASS: All API routes protected"

echo ""
echo "--- 2. dangerouslySetInnerHTML Usage ---"
DANGEROUS=$(grep -rl "dangerouslySetInnerHTML" components/ app/ 2>/dev/null)
if [ -n "$DANGEROUS" ]; then
  echo "  WARN: Found dangerouslySetInnerHTML in:"
  echo "$DANGEROUS" | sed 's/^/    - /'
  ISSUES=$((ISSUES + 1))
else
  echo "  PASS: No dangerouslySetInnerHTML usage"
fi

echo ""
echo "--- 3. Service Role Key on Client ---"
CLIENT_LEAK=$(grep -rl "SUPABASE_SERVICE_ROLE_KEY" components/ 2>/dev/null)
if [ -n "$CLIENT_LEAK" ]; then
  echo "  FAIL: Service role key referenced in client components:"
  echo "$CLIENT_LEAK" | sed 's/^/    - /'
  ISSUES=$((ISSUES + 1))
else
  echo "  PASS: Service role key not in client code"
fi

echo ""
echo "--- 4. Raw SQL with User Input ---"
RAW_SQL=$(grep -rnE "\.rpc\(|\.sql\(" lib/services/ app/api/ 2>/dev/null | grep -v "node_modules")
if [ -n "$RAW_SQL" ]; then
  echo "  WARN: Raw SQL/RPC calls found (verify no user input injection):"
  echo "$RAW_SQL" | head -10 | sed 's/^/    /'
  ISSUES=$((ISSUES + 1))
else
  echo "  PASS: No raw SQL calls found"
fi

echo ""
echo "--- 5. Missing Input Validation ---"
for f in $(find app/api -name "route.ts" 2>/dev/null); do
  if grep -q "req.json()" "$f" && ! grep -qE "\.parse\(|\.safeParse\(|zod|Zod|z\." "$f"; then
    echo "  WARN: $f - reads request body without Zod validation"
    ISSUES=$((ISSUES + 1))
  fi
done

echo ""
echo "--- 6. Console.log in Production ---"
CONSOLE_LOGS=$(grep -rn "console\.log" lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "node_modules" | grep -v ".next" | wc -l)
echo "  INFO: $CONSOLE_LOGS console.log statements found"
[ "$CONSOLE_LOGS" -gt 20 ] && echo "  WARN: Consider cleaning up debug logs" && ISSUES=$((ISSUES + 1))

echo ""
echo "=== SUMMARY: $ISSUES issues found ==="
exit $ISSUES
