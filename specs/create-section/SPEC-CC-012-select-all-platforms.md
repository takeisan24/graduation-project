# SPEC-CC-012: Add Select All / Clear All to Platform Selector

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, next-intl

---

## Problem

The `PostConfigurationForm` requires users to manually select each of the 8 platforms one by one. There is **no "Select All" or "Clear All"** shortcut:

```
☐ TikTok     [-] [2] [+]
☐ Instagram  [-] [2] [+]
☐ YouTube    [-] [1] [+]
☐ Facebook   [-] [1] [+]
☐ X          [-] [3] [+]
☐ Threads    [-] [2] [+]
☐ LinkedIn   [-] [1] [+]
☐ Pinterest  [-] [2] [+]
```

Users who want all 8 platforms must click 8 checkboxes — a tedious interaction.

---

## Root Cause

The feature was not included in the initial PostConfigurationForm design.

---

## Solution

Add a "Select All / Clear All" row at the top of the platform list:

```
┌────────────────────────────────────────────────────────┐
│  ☐ Chọn tất cả                                          │
│  ──────────────────────────────────────────────────────│
│  ☑ TikTok     [-] [2] [+]                             │
│  ☑ Instagram  [-] [2] [+]                             │
│  ...                                                    │
└────────────────────────────────────────────────────────┘
```

```tsx
// PostConfigurationForm.tsx — New component section:

// State for "select all" tracking
const isAllSelected = platforms.length === PLATFORMS.length;
const isNoneSelected = platforms.length === 0;

const handleSelectAll = () => {
  if (isAllSelected) {
    setPlatforms([]); // Clear all
  } else {
    // Select all with default counts
    const allPlatforms = PLATFORMS.map(p => ({
      type: p.type,
      count: p.defaultCount,
    }));
    setPlatforms(allPlatforms);
  }
};

// In the platform list header:
<div className="flex items-center gap-3 py-2 px-3 border-b border-border/30">
  <Checkbox
    id="select-all"
    checked={isAllSelected}
    onCheckedChange={handleSelectAll}
  />
  <label
    htmlFor="select-all"
    className="text-sm font-medium cursor-pointer select-none"
  >
    {t('selectAll')}
  </label>
  <span className="text-xs text-muted-foreground ml-auto">
    {platforms.length}/8 {t('selected')}
  </span>
</div>
```

Add i18n keys:
```json
{
  "selectAll": "Chọn tất cả",
  "clearAll": "Bỏ chọn tất cả",
  "selected": "đã chọn"
}
```

---

## Files to Change

- `components/features/create/forms/PostConfigurationForm.tsx` — Add select all UI

---

## New Files

None.

---

## Acceptance Criteria

- [ ] "Select All" checkbox appears above the platform list
- [ ] Clicking "Select All" selects all 8 platforms with default counts
- [ ] When all selected, checkbox shows checked state
- [ ] Clicking again when all selected → deselects all
- [ ] Counter shows "X/8 đã chọn" (e.g., "3/8 đã chọn")
- [ ] When deselecting individual platforms, "Select All" checkbox shows indeterminate state
- [ ] All text internationalized (vi + en)

---

## Rollback Plan

Remove the "Select All" header section from `PostConfigurationForm.tsx`. Simple JSX deletion — no logic depends on it.
