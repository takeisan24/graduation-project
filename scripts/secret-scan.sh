#!/bin/bash
# Secret Scan - Detect hardcoded secrets before commit
# Usage: bash scripts/secret-scan.sh

echo "=== SECRET SCAN ==="
FOUND=0

# Patterns to detect
PATTERNS=(
  "sk-[a-zA-Z0-9]{20,}"           # OpenAI keys
  "AIza[a-zA-Z0-9_-]{35}"         # Google API keys
  "sbp_[a-zA-Z0-9]{40,}"          # Supabase keys
  "eyJ[a-zA-Z0-9_-]{50,}"         # JWT tokens
  "ghp_[a-zA-Z0-9]{36}"           # GitHub tokens
  "SUPABASE_SERVICE_ROLE_KEY.*=.*eyJ"  # Supabase service role inline
  "password\s*[:=]\s*['\"][^'\"]{8,}"  # Hardcoded passwords
)

# Files to scan (exclude node_modules, .next, lock files)
FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)
if [ -z "$FILES" ]; then
  FILES=$(git diff --name-only --diff-filter=ACM 2>/dev/null)
fi
if [ -z "$FILES" ]; then
  FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.env*" \) \
    ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/package-lock.json" 2>/dev/null)
fi

for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(echo "$FILES" | xargs grep -lE "$pattern" 2>/dev/null)
  if [ -n "$MATCHES" ]; then
    echo "FAIL: Pattern '$pattern' found in:"
    echo "$MATCHES" | sed 's/^/  - /'
    FOUND=1
  fi
done

# Check for .env files in git
ENV_IN_GIT=$(git ls-files '*.env' '*.env.local' '*.env.production' 2>/dev/null)
if [ -n "$ENV_IN_GIT" ]; then
  echo "FAIL: .env files tracked by git:"
  echo "$ENV_IN_GIT" | sed 's/^/  - /'
  FOUND=1
fi

if [ $FOUND -eq 0 ]; then
  echo "PASS: No secrets detected"
fi

exit $FOUND
