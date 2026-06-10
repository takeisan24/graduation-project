# AUDIT-005: i18n & nội địa hóa (rò rỉ tiếng Việt + locale ngày)

> **Status**: Partially Implemented — B28/B29/B12 đã fix; B22/B21/B27/B15 vẫn còn
> **Priority**: 🟡 P2 (độ chỉn chu khi phản biện)
> **Stack**: Next.js 14, next-intl
> **Bugs**: B12 (fixed), B22, B21, B27, B28 (fixed), B29 (fixed), B15

---

## Problem

i18n **key parity hoàn hảo** (vi 1449 = en 1449) nhưng có **rò rỉ cục bộ**: nhiều chuỗi tiếng Việt
hardcode trong store/component, ngày giờ luôn format `vi-VN`, và 1 typo UI. Khi chuyển sang EN,
toast/lịch/validation vẫn lòi tiếng Việt → thiếu chuyên nghiệp.

---

## Audit Results (file:line — verified 2026-06-10)

| # | Vị trí | Vấn đề | Trạng thái |
|---|--------|--------|-----------|
| B28 | `components/.../forms/SourceForm.tsx` | Typo **"Artile"** → "Article" | ✅ **ĐÃ SỬA** — không còn trong code |
| B29 | `components/.../chat/AIChatbox.tsx:169,282,378` | `title="Tạo cuộc trò chuyện mới"` / context hardcode VN | ✅ **ĐÃ SỬA** — dùng `t('newChatTitle')`, `t('copyToFormat')`, `t('clearChatTitle')` |
| B12 | `components/.../connections/SettingsSection.tsx` | Toast/error hardcode VN | ✅ **ĐÃ SỬA** — grep không còn hardcoded VN toast |
| B22 | `store/create/publish.ts:86,338,356,371,461,590`, `store/shared/statusCheck.ts:208,503-518`, `store/drafts/draftsPageStore.ts:174,243,315`, `store/failed/failedPageStore.ts:331,443,471,498,500,562`, `store/shared/calendar.ts:172,259`, `store/create/posts.ts:443,449,491`, `store/create/modals/videoGen.ts:42,83,97,150`, `store/create/modals/imageGen.ts:124,164,206,240` | Toast/error hardcode tiếng Việt trong store | ⚠️ **VẪN CÒN** — ~41 chuỗi VN cứng |
| B21 | `store/create/publish.ts:201,309,480,588,614`, `store/shared/statusCheck.ts:202,498`, `components/.../modals/PublishModal.tsx:368,437,441`, `components/.../calendar/CalendarSection.tsx:388,453,709`, `components/.../calendar/MonthlyViewGrid.tsx:65`, `components/.../layout/ProjectGate.tsx:65` | `'vi-VN'` / `toLocaleDateString('vi-VN')` / `vietnameseWeekdays` cứng | ⚠️ **VẪN CÒN** — kể cả khi locale = EN |
| B21 (OK) | `components/.../settings/CreditTopUp.tsx:190,194,259`, `components/.../layout/TopBar.tsx:57` | `toLocaleString("vi-VN")` cho giá VND / `TopBar` kiểm tra locale trước | ✅ **HỢP LÝ** — CreditTopUp hiển thị giá VND luôn đúng; TopBar dùng `locale === "vi" ? "vi-VN" : "en-US"` |
| B27 | `components/.../forms/SourceForm.tsx:181,187,195,203` | `t('errors.pleaseEnterText') \|\| 'Vui lòng nhập...'` — fallback hardcode VN | ⚠️ **VẪN CÒN** |
| B15 | `components/.../modals/LightboxModal.tsx:61,70` | `aria-label="Tải xuống"`, `aria-label="Đóng"` hardcode VN | ⚠️ **VẪN CÒN** |

---

## Solution

1. **Store toasts (B22)**: Store không có access `useLocale()` (non-React). Hai hướng:
   - **Hướng A**: Truyền locale vào action function qua tham số — `schedulePost(postId, locale)`.
   - **Hướng B**: Dùng `lib/messages/errors.ts` với object `{ vi: '...', en: '...' }` + hàm helper `getMsg(key, locale)` đọc locale từ store/cookie.
2. **Locale ngày (B21)**: Thay `'vi-VN'` cứng bằng `useLocale()` (component) hoặc tham số locale (store util `formatDate/formatTime`); thay `vietnameseWeekdays` bằng mảng computed từ `Intl.DateTimeFormat` theo locale.
3. **Validation fallback (B27)**: Bỏ `|| 'Vui lòng nhập...'` — chỉ dùng `t('errors.x')`. Đảm bảo key tồn tại trong cả `vi.json` + `en.json`.
4. **aria-label (B15)**: Thêm i18n key `liftboxDownload`, `lightboxClose` vào `vi.json`/`en.json`; dùng `t('lightboxDownload')` thay chuỗi cứng.

---

## S1: Error States & Validation

| Scenario | Expected |
|----------|----------|
| User ở EN locale, lên lịch bài → Zernio lỗi | Toast lỗi hiện tiếng Anh, không phải "Không thể lên lịch bài đăng." |
| User ở EN, xem Calendar → chọn ngày | Tên tháng/thứ hiện tiếng Anh ("January", "Mon") |
| User ở EN, SourceForm nhập rỗng → submit | Validation message tiếng Anh ("Please enter a description") |
| User ở EN, LightboxModal hover Download | Tooltip / aria screen reader đọc "Download" không phải "Tải xuống" |
| i18n key thiếu trong `en.json` | next-intl fallback → hiện key thô (vd `errors.pleaseEnterText`) thay vì VN text — xấu hơn fallback || |
| `vi.json`/`en.json` mất parity sau khi thêm key | Build warning / runtime missing key |

---

## S2: Post-Completion Flow

Đây là refactor-only — không có "completion flow" mới với user. Sau khi sửa:

| Event | Result |
|-------|--------|
| Lên lịch thành công (EN locale) | Toast: "Scheduled X posts for [platform] at [time] on [date]" — ngày định dạng EN |
| Lên lịch thành công (VI locale) | Toast: giữ nguyên tiếng Việt như hiện tại |
| Validation SourceForm (EN) | "Please enter a description" / "Please enter a URL" |
| LightboxModal (EN) | `aria-label="Download"` / `aria-label="Close"` |
| Key parity sau thay đổi | `vi.json` và `en.json` đếm key bằng nhau |

---

## S3: Cross-Feature Integration

| When This Happens | Triggers / Updates |
|-------------------|--------------------|
| User đổi locale (vi ↔ en) | Store toasts phải đọc locale mới; hiện tại đọc cứng 'vi-VN' — không tự cập nhật |
| Scheduling action từ `publish.ts` | Toast dùng locale từ store state / tham số truyền vào |
| CalendarSection render | `Intl.DateTimeFormat` dùng `locale` từ `useLocale()` — ảnh hưởng label ngày |
| `PublishModal` hiển thị date picker | `vietnameseWeekdays` → cần thay bằng computed weekdays theo locale |
| SourceForm validation | `t('errors.x')` — cần EN key tương ứng trong `en.json` |

**Shared state**: `locale` từ `next-intl` (`useLocale()` hook, `getLocale()` server-side). Store không có access trực tiếp — cần truyền vào hoặc đọc từ cookie.

**Empty state**: Không áp dụng cho i18n refactor.

**Cleanup**: Không có state cần clear. Thay đổi thuần UI string.

---

## S4: Copy Review

- [x] B28: Typo "Artile" đã sửa thành "Article"
- [x] B29: AIChatbox titles/tooltips đã dùng `t()`
- [x] B12: SettingsSection toasts đã dùng `t()`
- [ ] B22: ~41 toast/error string trong 9 store file vẫn hardcode tiếng Việt — lộ ra khi EN locale
- [ ] B21: Tên tháng/ngày/thứ trong PublishModal, CalendarSection, MonthlyViewGrid vẫn format `vi-VN`
- [ ] B27: `SourceForm.tsx:181,187,195,203` — fallback `|| 'Vui lòng nhập...'` hiển thị tiếng Việt khi EN locale (nếu i18n key tồn tại thì `t()` không bao giờ falsy — fallback không cần thiết)
- [ ] B15: `LightboxModal.tsx:61,70` — `aria-label` không accessible cho EN screen reader

---

## S5: State & Persistence Matrix

| Data | Stored Where | Persists After Refresh? | Cleared When |
|------|-------------|------------------------|--------------|
| Locale (vi/en) | next-intl cookie/URL path segment | Yes (path segment `/vi/` vs `/en/`) | User đổi ngôn ngữ |
| Toast message text | React state (transient) | No | Toast dismiss / timeout |
| Hardcoded VN string trong store | Source code | N/A | Sau khi refactor |
| `vi.json`/`en.json` key parity | File system | Yes | Thay đổi thủ công |

---

## Files to Change

- `store/create/publish.ts` — thay ~10 toast chuỗi VN (B22, B21) ⚠️
- `store/shared/statusCheck.ts` — thay ~6 toast chuỗi VN + 2 chỗ `vi-VN` (B22, B21) ⚠️
- `store/drafts/draftsPageStore.ts` — thay 3 toast chuỗi VN (B22) ⚠️
- `store/failed/failedPageStore.ts` — thay 6 toast chuỗi VN (B22) ⚠️
- `store/shared/calendar.ts` — thay 2 toast chuỗi VN (B22) ⚠️
- `store/create/posts.ts` — thay 3 toast chuỗi VN (B22) ⚠️
- `store/create/modals/videoGen.ts` — thay 4 toast chuỗi VN (B22) ⚠️
- `store/create/modals/imageGen.ts` — thay 4 toast chuỗi VN (B22) ⚠️
- `components/.../modals/PublishModal.tsx` — thay 2 chỗ `vi-VN` + `vietnameseWeekdays` (B21) ⚠️
- `components/.../calendar/CalendarSection.tsx` — thay 3 chỗ `vi-VN` (B21) ⚠️
- `components/.../calendar/MonthlyViewGrid.tsx` — thay 1 chỗ `vi-VN` (B21) ⚠️
- `components/.../layout/ProjectGate.tsx` — thay fallback date `'vi-VN'` cứng (B21) ⚠️
- `components/.../forms/SourceForm.tsx` — bỏ fallback `|| '...'` 4 chỗ (B27) ⚠️
- `components/.../modals/LightboxModal.tsx` — i18n 2 aria-label (B15) ⚠️
- `lib/constants/calendar.ts` (nếu có `vietnameseWeekdays`) — thay bằng computed locale
- `messages/vi.json`, `messages/en.json` — thêm key mới, giữ parity ⚠️

---

## Acceptance Criteria

- [x] Typo "Artile" không còn trong code
- [x] AIChatbox, SettingsSection toasts dùng `t()`
- [ ] `grep -rn "toast\.(error\|success\|loading).*[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]" store` → 0 (không còn store toast cứng VN)
- [ ] `grep -rn "vi-VN" components store lib | grep -v CreditTopUp | grep -v "vi-VN.*en-US" | grep -v date.ts` → 0
- [ ] `grep -rn "|| '" components/features/create/forms/SourceForm.tsx` → 0
- [ ] Chuyển EN → lên lịch bài → toast + ngày định dạng EN
- [ ] `vi.json`/`en.json` parity giữ nguyên (đếm key bằng nhau)
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [ ] **Toast locale**: Đổi sang EN → lên lịch 1 bài → toast "Scheduled..." bằng tiếng Anh, không còn "Đang lên lịch...".
- [ ] **Calendar locale**: EN → mở Publish modal → lịch hiện thứ bằng tiếng Anh (Mon/Tue...), tên tháng EN.
- [ ] **CalendarSection**: EN → hover/click ngày → label ngày EN.
- [ ] **SourceForm validation**: EN → bỏ trống URL → validation message tiếng Anh.
- [ ] **LightboxModal**: EN → hover nút Download → tooltip/aria "Download", không phải "Tải xuống".
- [ ] **Draft store**: EN → xóa draft → toast "Draft deleted successfully." không phải "Đã xóa bản nháp thành công."
- [ ] **Failed store**: EN → retry bài lỗi → toast bằng tiếng Anh.
- [ ] **Key parity**: Sau khi thêm key mới → `jq 'keys | length' messages/vi.json` = `jq 'keys | length' messages/en.json`.
- [ ] **VI locale không đổi**: Dùng VI → tất cả toast/ngày vẫn tiếng Việt như trước.

---

## Rollback Plan
Revert component/store + messages; chỉ đụng chuỗi hiển thị, rollback an toàn, không ảnh hưởng logic.
