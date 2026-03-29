# CreatorHub x UTC Brand Guideline

> Hệ thống thiết kế lấy cảm hứng từ bộ nhận diện thương hiệu
> Trường Đại học Giao thông Vận tải (UTC)
> University of Transport and Communications

---

## 1. Color Palette

### 1.1 Primary Colors

Lấy từ logo UTC (viền navy) và áo đồng phục (sky blue).

| Token | Tên | HEX | OKLCH | Vai trò |
|-------|------|-----|-------|---------|
| `--utc-navy` | Navy Blue | `#1B3A6B` | `oklch(0.33 0.09 250)` | Primary dark - logo, headers, text đậm |
| `--utc-royal` | Royal Blue | `#2563EB` | `oklch(0.55 0.20 260)` | Primary action - buttons, links, focus |
| `--utc-sky` | Sky Blue | `#4CB8E8` | `oklch(0.73 0.13 230)` | Primary light - áo UTC, accents, badges |
| `--utc-sky-light` | Light Sky | `#B0E0F6` | `oklch(0.87 0.07 220)` | Tint nhẹ - hover states, backgrounds nhẹ |

### 1.2 Accent Colors

Lấy từ biểu tượng cánh chim vàng gold trên logo và sọc vàng trên áo.

| Token | Tên | HEX | OKLCH | Vai trò |
|-------|------|-----|-------|---------|
| `--utc-gold` | Golden Yellow | `#D4A843` | `oklch(0.74 0.13 80)` | Accent chính - highlights, CTA secondary |
| `--utc-gold-bright` | Bright Gold | `#F5C518` | `oklch(0.82 0.17 85)` | Accent sáng - badges, notifications, stars |
| `--utc-gold-soft` | Soft Gold | `#FDF4E3` | `oklch(0.97 0.03 85)` | Background accent - alert info, callouts |

### 1.3 Neutral Colors

| Token | Tên | HEX | OKLCH | Vai trò |
|-------|------|-----|-------|---------|
| `--neutral-50` | Snow | `#F8FAFC` | `oklch(0.98 0.003 250)` | Page background |
| `--neutral-100` | Ice | `#F1F5F9` | `oklch(0.96 0.005 250)` | Card/section background |
| `--neutral-200` | Silver | `#E2E8F0` | `oklch(0.91 0.01 250)` | Borders, dividers |
| `--neutral-300` | Mist | `#CBD5E1` | `oklch(0.85 0.015 250)` | Disabled state, subtle borders |
| `--neutral-400` | Steel | `#94A3B8` | `oklch(0.70 0.03 255)` | Placeholder text |
| `--neutral-500` | Slate | `#64748B` | `oklch(0.55 0.03 255)` | Muted text, captions |
| `--neutral-600` | Iron | `#475569` | `oklch(0.45 0.03 255)` | Secondary text |
| `--neutral-700` | Graphite | `#334155` | `oklch(0.36 0.03 255)` | Body text |
| `--neutral-800` | Charcoal | `#1E293B` | `oklch(0.26 0.03 255)` | Headings |
| `--neutral-900` | Midnight | `#0F172A` | `oklch(0.18 0.03 260)` | Foreground text |

### 1.4 Semantic Colors

| Token | Tên | HEX | OKLCH | Vai trò |
|-------|------|-----|-------|---------|
| `--success` | Success Green | `#10B981` | `oklch(0.70 0.17 165)` | Thành công, published |
| `--warning` | Warning Amber | `#F59E0B` | `oklch(0.78 0.17 75)` | Cảnh báo, pending |
| `--destructive` | Error Red | `#EF4444` | `oklch(0.63 0.24 25)` | Lỗi, xóa, failed |
| `--info` | Info Blue | `#3B82F6` | `oklch(0.62 0.20 260)` | Thông tin, tips |

### 1.5 Dark Mode

Dark mode đảo lightness, giữ hue & chroma.

| Token Light | Token Dark | Ghi chú |
|-------------|------------|---------|
| Background `0.98` | Background `0.14` | Navy-tinted dark |
| Foreground `0.18` | Foreground `0.93` | Near-white text |
| Primary `0.33` navy | Primary `0.62` sky | Sáng hơn để đọc được |
| Card `1.0` white | Card `0.18` dark | Dark card surface |
| Border `0.91` | Border `0.28` | Subtle border |

---

## 2. CSS Variable Mapping (shadcn/ui)

Ánh xạ palette UTC vào hệ thống biến shadcn:

```
Light Mode:
--background     → neutral-50     (Snow)
--foreground     → neutral-900    (Midnight)
--card           → white
--card-foreground→ neutral-900
--primary        → utc-navy       (Navy Blue - main brand)
--primary-foreground → white
--secondary      → neutral-100    (Ice)
--secondary-foreground → neutral-700
--muted          → neutral-100
--muted-foreground → neutral-500
--accent         → utc-gold       (Golden Yellow)
--accent-foreground → neutral-900
--destructive    → error red
--border         → neutral-200    (Silver)
--input          → neutral-200
--ring           → utc-royal      (Royal Blue - focus)
--success        → success green
--warning        → warning amber
```

---

## 3. Typography

### Font Stack
- **Primary**: `Inter` (Google Fonts, Vietnamese subset)
- **Mono**: `Geist Mono` (code blocks)

### Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display | `text-5xl` (48px) | Bold (700) | 1.1 | Hero heading |
| H1 | `text-4xl` (36px) | Bold (700) | 1.2 | Page titles |
| H2 | `text-3xl` (30px) | Semibold (600) | 1.3 | Section titles |
| H3 | `text-2xl` (24px) | Semibold (600) | 1.35 | Card titles |
| H4 | `text-xl` (20px) | Medium (500) | 1.4 | Subsection titles |
| Body Large | `text-lg` (18px) | Regular (400) | 1.6 | Lead paragraphs |
| Body | `text-base` (16px) | Regular (400) | 1.6 | Default body text |
| Body Small | `text-sm` (14px) | Regular (400) | 1.5 | Secondary text, labels |
| Caption | `text-xs` (12px) | Medium (500) | 1.4 | Timestamps, badges |

### Quy tắc
- Headings: `text-foreground` (dark)
- Body: `text-neutral-700` hoặc `text-foreground`
- Muted: `text-muted-foreground`
- Links: `text-primary hover:underline` hoặc `text-utc-royal`
- Max width cho paragraph: `max-w-prose` (65ch)

---

## 4. Spacing & Layout

### Spacing Scale
Dùng Tailwind default (4px base unit):
- `gap-1` (4px) → Inline elements
- `gap-2` (8px) → Compact spacing
- `gap-3` (12px) → Form elements
- `gap-4` (16px) → Default spacing
- `gap-6` (24px) → Card content padding
- `gap-8` (32px) → Between groups
- `gap-12` (48px) → Between sections (small)
- `gap-16` (64px) → Between sections (medium)
- `gap-24` (96px) → Between major sections

### Container
```
max-w-7xl (1280px) mx-auto px-4 sm:px-6 lg:px-8
```

### Section Pattern
```tsx
<section className="py-16 md:py-24">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {/* Section label */}
    <Badge variant="outline" className="mb-4">Features</Badge>
    {/* Section heading */}
    <h2 className="text-3xl font-semibold text-foreground mb-3">...</h2>
    {/* Section description */}
    <p className="text-lg text-muted-foreground max-w-2xl">...</p>
    {/* Section content */}
    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ...
    </div>
  </div>
</section>
```

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 6px | Small chips, tags |
| `rounded-md` | 8px | Inputs, small buttons |
| `rounded-lg` | 10px | Cards, dialogs (default) |
| `rounded-xl` | 14px | Large cards, hero elements |
| `rounded-2xl` | 16px | Feature cards, images |
| `rounded-full` | 9999px | Avatars, pills, badges |

---

## 6. Shadows

| Name | Value | Usage |
|------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle (inputs) |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.07)` | Cards default |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.08)` | Cards hover |
| `shadow-utc` | `0 4px 14px -2px rgba(27,58,107,0.12)` | Primary branded shadow |
| `shadow-gold` | `0 4px 14px -2px rgba(212,168,67,0.15)` | Accent highlight shadow |

---

## 7. Component Patterns

### 7.1 Buttons

Luôn dùng shadcn `<Button>`. Không bao giờ dùng `<button>` thuần.

```tsx
// Primary action (CTA)
<Button>Tạo bài viết</Button>

// Secondary action
<Button variant="secondary">Hủy</Button>

// Outline
<Button variant="outline">Xem thêm</Button>

// Ghost (icon buttons, toolbar)
<Button variant="ghost" size="icon"><PlusIcon /></Button>

// Destructive
<Button variant="destructive">Xóa</Button>

// Link style
<Button variant="link">Tìm hiểu thêm</Button>

// UTC Gold accent (custom variant - add if needed)
// className="bg-utc-gold text-white hover:bg-utc-gold/90"
```

### 7.2 Cards

```tsx
<Card className="hover:shadow-lg transition-shadow">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

### 7.3 Forms

```tsx
// Input
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" placeholder="you@utc.edu.vn" />
</div>

// Select
<Select>
  <SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger>
  <SelectContent>
    <SelectItem value="opt1">Option 1</SelectItem>
  </SelectContent>
</Select>

// Checkbox
<div className="flex items-center space-x-2">
  <Checkbox id="remember" />
  <Label htmlFor="remember">Ghi nhớ đăng nhập</Label>
</div>

// Textarea
<Textarea placeholder="Nhập nội dung..." />
```

### 7.4 Dialogs/Modals

```tsx
<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline">Hủy</Button>
      <Button>Xác nhận</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 7.5 Dropdowns

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 7.6 Tooltips

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon"><InfoIcon /></Button>
  </TooltipTrigger>
  <TooltipContent>Helpful information</TooltipContent>
</Tooltip>
```

---

## 8. Gradients & Effects

### UTC Gradient (Hero, CTA sections)
```css
/* Navy → Sky gradient */
background: linear-gradient(135deg, var(--utc-navy), var(--utc-royal), var(--utc-sky));

/* Gold shimmer accent */
background: linear-gradient(135deg, var(--utc-gold), var(--utc-gold-bright));
```

### Glass Effect (Cards trên gradient background)
```css
background: oklch(1 0 0 / 0.8);
backdrop-filter: blur(12px);
border: 1px solid oklch(1 0 0 / 0.2);
```

### Animated Gradient Mesh (Hero background)
- Orb 1: Navy blue (top-left)
- Orb 2: Sky blue (bottom-right)
- Orb 3: Gold accent (center, subtle)
- Noise overlay: 3% opacity

---

## 9. Responsive Breakpoints

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Wide desktop |
| `2xl` | 1536px | Ultra-wide |

### Grid Patterns
- **Features grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Stats row**: `grid-cols-2 md:grid-cols-4`
- **Two-column layout**: `grid-cols-1 lg:grid-cols-2`
- **Dashboard sidebar**: `w-64` fixed + fluid content

---

## 10. Animation

### Transitions
- Default: `transition-all duration-200 ease-out`
- Hover cards: `transition-shadow duration-300`
- Color change: `transition-colors duration-150`

### Framer Motion Patterns
```tsx
// Fade in on scroll
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>

// Stagger children
const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }
```

---

## 11. Icon System

- **Library**: Lucide React
- **Size default**: `w-5 h-5` (20px)
- **Size small**: `w-4 h-4` (16px) — inline with text
- **Size large**: `w-6 h-6` (24px) — standalone icons
- **Color**: `currentColor` (inherits text color)
- **Stroke width**: Default (2px)

---

## 12. Do's and Don'ts

### DO
- Dùng shadcn components cho MỌI UI element
- Dùng CSS variables (`bg-primary`, `text-foreground`) thay vì hardcode colors
- Dùng `cn()` utility để merge classes
- Giữ consistent spacing với Tailwind scale
- Dùng semantic color tokens (`destructive`, `success`, `warning`)
- Hỗ trợ dark mode cho mọi component

### DON'T
- Không dùng raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`
- Không hardcode hex colors inline (`style={{ color: '#1B3A6B' }}`)
- Không tạo custom modal/dropdown khi shadcn đã có
- Không mix nhiều border-radius khác nhau trong cùng 1 context
- Không bỏ qua hover/focus states
- Không dùng `!important`
