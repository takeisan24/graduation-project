# AUDIT-005: i18n & nội địa hóa (rò rỉ tiếng Việt + locale ngày)

> **Status**: Draft
> **Priority**: 🟡 P2 (độ chỉn chu khi phản biện)
> **Stack**: Next.js 14, next-intl
> **Bugs**: B12, B13, B15, B21, B22, B27, B28, B29

---

## Problem

i18n **key parity hoàn hảo** (vi 1449 = en 1449) nhưng có **rò rỉ cục bộ**: nhiều chuỗi tiếng Việt
hardcode trong store/component, ngày giờ luôn format `vi-VN`, và 1 typo UI. Khi chuyển sang EN,
toast/lịch/validation vẫn lòi tiếng Việt → thiếu chuyên nghiệp.

---

## Audit Results (file:line)

| # | Vị trí | Vấn đề |
|---|--------|--------|
| B22 | 10 file store (41 chỗ): `store/create/publish.ts`, `store/shared/statusCheck.ts`, `store/drafts/*`, `store/create/posts.ts`, `store/create/modals/imageGen.ts`,`videoGen.ts`, `store/failed/*`, `store/published/*`, `store/calendar`, `store/api-dashboard/*` | Toast/error hardcode tiếng Việt (vd `"Đang lên lịch bài đăng, vui lòng chờ..."`, `"Đã lên lịch ... bài đăng..."`) |
| B12 | `components/.../connections/SettingsSection.tsx:171,177,183,259,463` | Toast/error hardcode VN |
| B21 | 14 file (29 chỗ) `vi-VN`/`toLocaleDateString`/`Intl.DateTimeFormat('vi-VN')`: `PublishModal.tsx:380,449`, `CalendarSection.tsx:388,453,709`, `publish.ts`, `CreditTopUp.tsx`, `MonthlyViewGrid.tsx`, `ActionBar.tsx`, `TopBar.tsx`, `PublishModal vietnameseWeekdays:12,453` | Ngày/giờ + thứ trong tuần luôn định dạng VN kể cả bản EN |
| B27 | `components/.../forms/SourceForm.tsx:197,205,213,219,223,344,527` + `t('x') \|\| 'fallback VN'` (189,195,203,209) | Validation tiếng Việt cứng / fallback `\|\|` |
| B28 | `components/.../forms/SourceForm.tsx:492` | Typo UI **"Artile"** → "Article" |
| B29 | `components/.../chat/AIChatbox.tsx:190,381` | `title="Tạo cuộc trò chuyện mới"`, context `"Bài viết"/"Tất cả"` hardcode |
| B15 | `LightboxModal.tsx:61,70,80`, `VideoPreviewOverlay.tsx:23`, `MediaLibrarySelectorModal.tsx:222` | `aria-label`/`alt`/`title` hardcode VN ("Đóng","Tải xuống","Ảnh phóng to","Hậu kỳ") |

---

## Solution

1. **Store (B22)**: chuyển toast/error sang hằng số tập trung `lib/messages/errors.ts` (đã có sẵn pattern) — và bản EN tương ứng; store đọc theo locale hiện tại (truyền locale hoặc helper i18n cho non-React).
2. **Locale ngày (B21)**: thay mọi `'vi-VN'` cứng bằng `useLocale()` (component) hoặc tham số locale (util `formatDate/formatTime`); thay `vietnameseWeekdays` bằng mảng theo locale.
3. **Validation (B27)**: bỏ pattern `t('errors.x') || 'fallback VN'`, chỉ dùng `t('errors.x')`; thêm key thiếu vào `vi.json` + `en.json`.
4. **Typo (B28)**: sửa "Artile" → "Article" (qua i18n key).
5. **Tooltip/aria (B29, B15)**: chuyển sang `t()`.

> Tham chiếu spec cũ cùng chủ đề: `specs/create-section/SPEC-CC-006-i18n-hardcoded-strings.md` và `specs/thesis-cleanup/THESIS-002`. Spec này mở rộng sang **store** và **locale ngày** — phần trước chưa phủ.

---

## S4: Copy Review

- [ ] Mọi toast/error hiển thị đúng ngôn ngữ theo locale (vi/en)
- [ ] Ngày/giờ/thứ định dạng theo locale (không cứng vi-VN)
- [ ] Không còn typo UI ("Artile")
- [ ] aria-label/alt/title đều qua i18n

---

## Files to Change

- `store/*` (10 file ở bảng) — chuyển chuỗi sang `lib/messages/errors.ts` + EN
- `lib/messages/errors.ts` — thêm bản EN/đa ngôn ngữ
- `lib/utils/date.ts` + các caller — nhận locale thay vì 'vi-VN'
- `components/.../modals/PublishModal.tsx`, `calendar/CalendarSection.tsx`, `MonthlyViewGrid.tsx`, `editor/ActionBar.tsx`, `layout/TopBar.tsx`, `settings/CreditTopUp.tsx` — fix locale ngày
- `components/.../forms/SourceForm.tsx` — bỏ fallback VN + sửa typo (B27, B28)
- `components/.../chat/AIChatbox.tsx`, `modals/LightboxModal.tsx`, `shared/VideoPreviewOverlay.tsx`, `modals/MediaLibrarySelectorModal.tsx` — i18n aria/title (B29, B15)
- `messages/vi.json`, `messages/en.json` — thêm key mới (giữ parity)

---

## Acceptance Criteria

- [ ] `grep -rn "vi-VN" components store lib | grep -v date.ts` → 0 (chỉ util nhận locale)
- [ ] `grep -rn "|| '" components/features/create/forms/SourceForm.tsx` → 0
- [ ] Chuyển EN ở Connections/Publish/Calendar → toast + ngày + validation đều tiếng Anh
- [ ] Không còn "Artile"
- [ ] `vi.json`/`en.json` parity giữ nguyên (đếm key bằng nhau)
- [ ] `tsc --noEmit` + `npm run lint` pass

---

## S6: Manual QA

- [ ] Đổi sang EN → lên lịch 1 bài → toast bằng tiếng Anh, ngày định dạng EN.
- [ ] EN → mở Publish modal → lịch hiện thứ bằng tiếng Anh (Mon/Tue...).
- [ ] EN → SourceForm nhập URL sai → thông báo lỗi tiếng Anh; tab hiện "Article".

---

## Rollback Plan
Revert component/store + messages; vì chỉ đụng chuỗi hiển thị, rollback an toàn, không ảnh hưởng logic.
