# THESIS-001: Replace Inappropriate Images & Remove Unused Assets

> **Status**: Draft
> **Stack**: Next.js 14, public/images/

## Overview

**Goal**: Replace `shego.jpg` with a proper placeholder avatar across all references, and delete `maiovo_icon.png` (unused — no code references found).
**Trigger**: Graduation thesis audit found `shego.jpg` is a person's photo used as mock avatar throughout the app, which is inappropriate for a thesis.
**Users affected**: Landing page testimonial, PublishModal, RetryDetailModal, store fallback logic

---

## Acceptance Criteria

- [ ] `public/images/shego.jpg` is deleted
- [ ] `public/images/maiovo_icon.png` is deleted (confirmed: no code references)
- [ ] All code references to `/shego.jpg` are replaced with `/placeholder-user.jpg`
- [ ] `testimonial-section.tsx` uses `placeholder-user.jpg` as author photo
- [ ] `npm run build` passes with 0 errors

---

## S1: Error States & Validation

| Scenario | Expected Behavior |
|----------|-----------------|
| `placeholder-user.jpg` doesn't exist | Create a generic silhouette SVG/PNG before deleting shego.jpg |
| `shego.jpg` deleted before references updated | App shows broken image icons → must update ALL references first |
| Next.js image optimization | `placeholder-user.jpg` should be added to `next.config.ts` unoptimized list if not already |

---

## S2: Post-Completion Flow

| Event | Result |
|-------|--------|
| Images replaced | Testimonial shows placeholder avatar, no broken images |
| Build succeeds | Safe to commit |

---

## S3: Cross-Feature Integration

| Where shego.jpg is used | Replacement | File |
|-------------------------|-------------|------|
| Landing page testimonial author photo | `/placeholder-user.jpg` | `components/shared/testimonial-section.tsx:63` |
| Default account avatar in PublishModal | `/placeholder-user.jpg` | `components/features/create/modals/PublishModal.tsx:65,90,132` |
| Mock account avatars (failed posts) | `/placeholder-user.jpg` | `components/features/create/failed/RetryDetailModal.tsx:16-25` |
| Fallback profilePic in services | `/placeholder-user.jpg` | `lib/services/posts/failedPostsService.ts:102` |
| Fallback profilePic in services | `/placeholder-user.jpg` | `lib/services/posts/publishedPostsService.ts:95` |
| Fallback profilePic in stores | `/placeholder-user.jpg` | `store/failed/failedPageStore.ts:105,247` |
| Fallback profilePic in stores | `/placeholder-user.jpg` | `store/published/publishedPageStore.ts:101,286` |

**Total references to update: 10 locations across 6 files**

---

## S4: Copy Review

N/A — this is asset replacement, no user-facing text changes.

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Avatar fallback path | 6 source files | Yes (code) | When code is updated |
| Image files | `public/images/` | Yes (static files) | When deleted |

---

## S6: Manual QA Scenarios

- [ ] **Happy path**: Delete shego.jpg → build succeeds → landing page shows placeholder avatar in testimonial
- [ ] Landing page testimonial: author photo shows placeholder (not broken image)
- [ ] PublishModal: select account with no profile pic → shows placeholder avatar
- [ ] Failed posts: retry detail shows placeholder for mock account avatars
- [ ] `npm run build` → 0 errors

---

## Implementation Steps

1. **Verify placeholder exists**: Check that `/placeholder-user.jpg` or similar exists in `public/images/`
2. **Update all 10 references** from `/shego.jpg` → `/placeholder-user.jpg`
3. **Delete `public/images/shego.jpg`**
4. **Delete `public/images/maiovo_icon.png`** (unused)
5. **Run build** to verify

**Single PR**: All changes in one commit for clean review.
