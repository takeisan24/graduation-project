# Create Section — UI/UX Rework Master Plan

> **Project**: CreatorHub | **Date**: 2026-04-05
> **Reviewed by**: 4-agent team (Visual Designer, UX Specialist, Code Quality Reviewer, i18n Auditor)
> **Current Score**: 5.75/10 ❌ FAIL
> **Recommendation**: Complete all Sprint 0 specs before marking PASS

---

## Executive Summary

The Create Section has solid foundational architecture but requires significant rework before reaching production quality. Primary blockers are **credits system removal**, **UX wayfinding issues**, and **hardcoded Vietnamese strings**.

> **User decisions incorporated:**
> - Credits system → **removed entirely** (no payment system in app)
> - WizardStepIndicator + TopBar → **combined into 1 row**
> - i18n count → **actual ~34 strings** (not 67 — agent overcounted)

---

## Sprint Overview

### 🚨 Sprint 0 — Critical Blockers (Must Fix First)
*Estimated: 3-5 days | Blocks all subsequent work*

| # | Spec | Issue | Effort | Status |
|---|------|-------|--------|--------|
| S-001 | Remove Credits Badge + brand-yellow CSS | Credits system gone; CSS undefined; badge dead UI | 15 min | Updated ✅ |
| S-002 | `rounded-[5px]` → `rounded-xl` | Design system violation | 15 min | Draft |
| S-003 | Remove `-top-[31px]` + credits | Fragile negative margin + credits removed | 1-2h | Updated ✅ |
| S-004 | Wizard Indicator + TopBar Combined | Users lost in wizard; save vertical space | 2-3h | Updated ✅ |
| S-005 | Tablet breakpoint gap | Sources unreachable 768px-1024px | 15 min | Draft |
| S-006 | ~34 hardcoded Vietnamese strings | MEMORY.md violation | 3-4h | Updated ✅ |

### 🟡 Sprint 1 — TypeScript & Performance
*Estimated: 5-7 days*

| # | Spec | Issue | Effort |
|---|------|-------|--------|
| S-007 | Replace `any` types | 10+ any types, no type safety | 2-3h |
| S-008 | Extract AI prompts to lib | 87-line inline prompt in store | 2-3h |
| S-009 | Platform constants SSO | Duplicated in 3 files | 1-2h |
| S-010 | AI Chat reserve space | Layout reflow on toggle | 1-2h |
| S-011 | React.memo + useCallback | Unnecessary re-renders | 2-3h |

### 🟢 Sprint 2 — Polish & Enhancement
*Estimated: 3-4 days*

| # | Spec | Issue | Effort |
|---|------|-------|--------|
| S-012 | Select All / Clear All | Manual click for 8 platforms | 1h |
| S-013 | Mobile keyboard fix | Chat input covered by keyboard | 30 min |
| S-014 | Keyboard shortcuts | Power user productivity | 1-2h |
| S-015 | Network error UI | Indefinite spinner on failure | 2-3h |

---

## User Decisions (Incorporated)

| Decision | Choice | Impact |
|-----------|--------|--------|
| Credits system | **REMOVED** | S-001 + S-003 simplified |
| ActionBar count row | **Combined with 2-row layout** | S-003 clean approach |
| Wizard indicator | **Combined with TopBar** (single row) | S-004 redesigned |
| i18n count | **~34 actual strings** (not 67) | S-006 more accurate |

---

## Accurate i18n Audit Summary

| File | Hardcoded Strings | Notes |
|------|-----------------|-------|
| `ActionBar.tsx` | ~12 | Credits removed (1 gone), Format/Translate dialogs |
| `SourceModal.tsx` | ~7 | Upload, toast, modal title |
| `SourceForm.tsx` | ~8 | `||` fallback violations in error messages |
| `PublishModal.tsx` | ~4 + 1 vi-VN | Locale date formatting |
| `AIChatbox.tsx` | ~2 | Tooltips only |
| `PostEditor.tsx` | 0 | ✅ Already clean |
| `PostConfigurationForm.tsx` | ~1 | Credits removed |
| **TOTAL** | **~34 strings** | Down from 67 (overcounted) |

---

## Quality Gates

To pass review and move to the next section:

- [ ] **Sprint 0: All 6 specs completed**
  - [ ] S-001: No `creditsRemaining`, no `Coins`, no `brand-yellow` in create section
  - [ ] S-002: No `rounded-[5px]` in create section
  - [ ] S-003: No `-top-` negative margin in ActionBar; no credits display
  - [ ] S-004: Combined TopBar shows wizard breadcrumb in 1 row; Sources/AI Chat toggle works
  - [ ] S-005: Sources panel accessible at 768px, 1024px, 1280px
  - [ ] S-006: `grep -r "|| '" components/features/create/` returns 0
- [ ] **Visual Designer re-review**: Score ≥ 7.5/10
- [ ] **UX Specialist re-review**: Score ≥ 7.0/10
- [ ] **i18n Auditor re-review**: 0 hardcoded strings

---

## Spec Files Index

All specs are saved in `specs/create-section/`:

```
specs/create-section/
├── README.md                              ← Master index (this file)
├── SPEC-CC-001-brand-yellow-fix.md        ← Credits removed ✅ UPDATED
├── SPEC-CC-002-rounded-fix.md              ← Design system violation
├── SPEC-CC-003-negative-margin-fix.md     ← Credits removed ✅ UPDATED
├── SPEC-CC-004-wizard-step-indicator.md   ← Combined TopBar ✅ UPDATED
├── SPEC-CC-005-tablet-breakpoint-fix.md   ← Responsive breakpoint
├── SPEC-CC-006-i18n-hardcoded-strings.md  ← ~34 strings ✅ UPDATED
├── SPEC-CC-007-typescript-any-cleanup.md  ← Type safety
├── SPEC-CC-008-extract-ai-prompts.md     ← AI prompt extraction
├── SPEC-CC-009-platform-constants.md     ← SSO for platforms
├── SPEC-CC-010-ai-chat-reserve-space.md   ← Layout reflow fix
├── SPEC-CC-011-memo-performance.md      ← React optimization
├── SPEC-CC-012-select-all-platforms.md   ← UX polish
├── SPEC-CC-013-mobile-keyboard-fix.md     ← Mobile UX
├── SPEC-CC-014-keyboard-shortcuts.md      ← Keyboard shortcuts
└── SPEC-CC-015-network-error-ui.md        ← Error handling UI
```

---

## Testing Checklist

After each sprint:

- [ ] `npm run build` — passes with 0 errors
- [ ] `npm run lint` — passes with 0 warnings
- [ ] `tsc --noEmit` — passes with 0 errors
- [ ] Manual smoke test: Create → Generate → Edit → Publish flow
- [ ] Responsive test: 375px (mobile), 768px (tablet), 1024px (desktop), 1920px (wide)
- [ ] Dark mode toggle: all components render correctly
- [ ] i18n toggle: all strings switch vi ↔ en correctly
