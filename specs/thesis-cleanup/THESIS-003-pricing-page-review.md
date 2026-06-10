# THESIS-003: Pricing Page & Mock Payment Review

> **Status**: Draft
> **Stack**: Next.js 14, PricingPage

## Overview

**Goal**: Review whether the Pricing page and mock payment system are appropriate for a graduation thesis presentation, and take appropriate action.
**Trigger**: Graduation thesis audit found commercial pricing ($29/$49/$99 per month) and a mock payment QR system in the app.
**Users affected**: Graduation thesis examiners — may question commercial elements in a student project

---

## Acceptance Criteria

- [ ] Pricing page is reviewed and a decision is made (keep with note / remove / make clearly academic)
- [ ] Mock payment QR code is reviewed — either removed or clearly labeled as thesis-only demo
- [ ] Footer copyright changed from "CreatorHub, Inc." to academic-appropriate attribution
- [ ] Any language implying commercial operation is removed or contextualized
- [ ] `npm run build` passes with 0 errors

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|-----------------|
| Pricing page removed | Navigation links to `/pricing` should 404 or redirect — update nav links |
| Mock payment component removed | Any "Buy Credits" button should be disabled or removed |
| Copyright changed | All footer instances updated |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Pricing page kept with academic note | App maintains current behavior, thesis clearly labeled |
| Pricing page removed | No broken nav links, credits feature gracefully degraded |
| Footer updated | Academic attribution in all pages |

---

## S3: Cross-Feature Integration

| When This Happens | Other Features | Effect |
|-------------------|---------------|--------|
| Pricing page removed | Nav links, sidebar links | Must update all `/pricing` references |
| Credits system removed | TopBarActions, CreateSection | Credits display may show 0 or be hidden |
| Footer changed | All pages | Shared layout component |

**Shared state**: `TopBarActions` may show credits count — if credits system is removed, update accordingly

---

## S4: Copy Review

- [ ] Footer: "© 2025 CreatorHub, Inc." → "© 2025 [Tên SV] — Đồ án tốt nghiệp CNTT, Trường ĐH GTVT" (or similar)
- [ ] Pricing page: any "Buy Now", "Get Started" buttons → review if appropriate
- [ ] Mock payment modal: current text "Môi Trường Giả Lập" is honest — keep or remove entirely
- [ ] No text implies commercial transaction is real

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Footer text | Layout component or config | Yes (code) | Manual edit |
| Nav links to pricing | Sidebar / TopBar components | Yes (code) | Manual edit |
| Credits system | Zustand store | Yes (session) | User logout / store reset |

---

## S6: Manual QA Scenarios

- [ ] Navigate to `/pricing` → page content reviewed
- [ ] Click any "Buy Credits" button → behavior matches decision
- [ ] Footer visible on all pages → shows updated copyright
- [ ] No text implying this is a commercial SaaS product
- [ ] `npm run build` → 0 errors

---

## Decision Options

### Option A: Keep Pricing Page (Recommended for Thesis)
- Keep the page as-is but add a clear banner at top:
  > "Trang này chỉ mang tính minh họa cho đồ án tốt nghiệp. Không có giao dịch thực tế."

### Option B: Remove Pricing Page
- Delete `app/[locale]/(pages)/pricing/page.tsx`
- Remove all nav/sidebar links pointing to `/pricing`
- Hide credits system from UI

### Option C: Replace with Academic Context Page
- Replace pricing with a page explaining the thesis: features demo, architecture overview, credits system explanation

---

## Recommendation

**Option A** is recommended — keeps all features functional for thesis demo while adding a clear academic disclaimer. This demonstrates the full feature set while being academically honest.
