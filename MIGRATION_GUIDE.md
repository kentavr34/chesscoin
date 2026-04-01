# Design System Migration Guide

**Purpose**: Systematic refactoring of components from hardcoded values to design system tokens.

---

## Phase 1: Add Design Tokens to CSS (Foundation)

### Step 1: Add DESIGN_TOKENS.css to index.css

Copy **ALL CONTENT** from `DESIGN_TOKENS.css` and paste it into `frontend/src/index.css`:

1. Open `frontend/src/index.css`
2. Find the line with responsive breakpoints (line 409):
   ```css
   /* Responsive Breakpoints (L2) */
   --breakpoint-xs: 320px;
   ...
   ```
3. **BEFORE** this section, paste ALL content from `DESIGN_TOKENS.css`
4. Save the file

**Result**: All design tokens are now available globally via CSS variables.

---

## Phase 2: Refactor Components (Immediate Work)

### Pattern 1: Typography in Inline Styles

**Component**: HomePage.tsx (line 75-91)

#### BEFORE (Current — Broken):
```tsx
<div style={{ fontSize: 12, color: '#8B92A8', marginBottom: 4 }}>Игрок</div>
<div style={{ fontSize: 14, fontWeight: 700, color: '#F0F2F8', marginBottom: 8 }}>
  {user.firstName || 'Player'}
</div>
<div style={{ fontSize: 11, color: '#4A5270', lineHeight: 1.6 }}>
  <div>W: {user.wins || 0}</div>
  <div>L: {user.losses || 0}</div>
</div>
```

#### AFTER (Using Design System):
```tsx
<div style={{
  fontSize: 'var(--label-font-size)',           /* 12px */
  fontWeight: 'var(--label-font-weight)',       /* 600 (semibold) */
  color: 'var(--color-text-secondary)',         /* #8B92A8 */
  marginBottom: 'var(--gap-sm)',                /* 8px */
  letterSpacing: 'var(--letter-spacing-wide)'  /* 0.5px */
}}>
  Игрок
</div>

<div style={{
  fontSize: 'var(--font-size-base)',            /* 14px */
  fontWeight: 'var(--font-weight-bold)',        /* 700 */
  color: 'var(--color-text-primary)',           /* #F0F2F8 */
  marginBottom: 'var(--gap-md)',                /* 12px */
  lineHeight: 'var(--line-height-normal)'       /* 1.5 */
}}>
  {user.firstName || 'Player'}
</div>

<div style={{
  fontSize: 'var(--font-size-sm)',              /* 12px */
  color: 'var(--color-text-muted)',             /* #4A5270 */
  lineHeight: 'var(--line-height-relaxed)',    /* 1.75 */
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--gap-xs)'                          /* 4px */
}}>
  <div>W: {user.wins || 0}</div>
  <div>L: {user.losses || 0}</div>
</div>
```

**Key Changes**:
- Hardcoded `fontSize: 12` → `fontSize: 'var(--label-font-size)'`
- Hardcoded `fontWeight: 700` → `fontWeight: 'var(--font-weight-bold)'`
- Hardcoded `marginBottom: 4` → `marginBottom: 'var(--gap-xs)'` or `'var(--gap-sm)'`
- Added line heights for readability
- Added letter-spacing for labels
- Colors now reference CSS variables (consistency with light mode)

---

### Pattern 2: Button Styling

**Component**: HomePage.tsx (line 96-110) — "Play vs Jarvis" button

#### BEFORE (Current):
```tsx
<button
  onClick={() => setShowJarvisModal(true)}
  style={{
    width: '100%',
    padding: '20px',
    fontSize: 18,
    fontWeight: 700,
    color: '#F0F2F8',
    background: 'linear-gradient(135deg, #F5C842, #E8B61E)',
    border: 'none',
    borderRadius: 16,
    cursor: 'pointer',
    marginBottom: 32,
  }}
>
  ♘ Play vs Jarvis
</button>
```

#### AFTER (Using Design System):
```tsx
<button
  onClick={() => setShowJarvisModal(true)}
  style={{
    width: '100%',
    height: 'var(--button-height-lg)',          /* 56px */
    paddingLeft: 'var(--button-padding-x-lg)',  /* 24px */
    paddingRight: 'var(--button-padding-x-lg)',
    fontSize: 'var(--font-size-lg)',            /* 18px */
    fontWeight: 'var(--font-weight-bold)',      /* 700 */
    color: 'var(--color-text-primary)',         /* #F0F2F8 */
    background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))',
    border: 'none',
    borderRadius: 'var(--radius-lg)',           /* 16px */
    cursor: 'pointer',
    marginBottom: 'var(--gap-2xl)',             /* 32px */
    transition: `all ${--transition-normal} ${--ease-in-out}`,
  }}
>
  ♘ Play vs Jarvis
</button>
```

**Key Changes**:
- Added explicit `height` using button sizing system
- Used button padding variables
- Font properties reference CSS variables
- Colors reference CSS variables (works in light/dark mode)
- Border radius uses design token
- Added transition for smooth interactions

---

### Pattern 3: Card/Container Styling

**Component**: HomePage.tsx (line 63-93) — Profile Card

#### BEFORE (Current):
```tsx
<div style={{
  padding: '16px',
  background: 'var(--color-bg-card, #13161F)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  marginBottom: 24,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}}>
  {/* Content */}
</div>
```

#### AFTER (Using Design System):
```tsx
<div style={{
  padding: 'var(--card-padding-lg)',            /* 16px */
  background: 'var(--color-bg-card)',
  border: 'var(--card-border-width) solid var(--card-border-color)',
  borderRadius: 'var(--card-border-radius)',    /* 12px (--radius-m) */
  marginBottom: 'var(--gap-2xl)',               /* 24px */
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--gap-md)',                         /* 12px */
  boxShadow: 'var(--shadow-sm)',                /* Adds subtle depth */
}}>
  {/* Content */}
</div>
```

**Key Changes**:
- Padding uses card padding system
- Border uses design token variables (consistent, responsive)
- Border radius uses design token
- Gap uses spacing system
- Added shadow for visual hierarchy
- All values are maintainable in one place

---

### Pattern 4: Modal Styling

**Component**: GameSetupModal.tsx (line ~200)

#### BEFORE (Current):
```tsx
<div style={{
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90vw',
  maxWidth: 480,
  backgroundColor: 'var(--color-bg-modal)',
  border: '2px solid rgba(245, 200, 66, 0.2)',
  borderRadius: 20,
  padding: 24,
  zIndex: 300,
  boxShadow: '0 0 80px rgba(245, 200, 66, 0.12)',
}}>
  {/* Content */}
</div>
```

#### AFTER (Using Design System):
```tsx
<div style={{
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'var(--modal-width-lg)',               /* clamp(280px, 90vw, 480px) on mobile */
  backgroundColor: 'var(--color-bg-modal)',
  border: 'var(--card-border-width) solid var(--modal-launch-border)',
  borderRadius: 'var(--radius-l)',              /* 16px */
  padding: 'var(--modal-padding)',              /* --space-l on desktop, --space-m on mobile */
  zIndex: 'var(--z-modal)',                     /* 300 */
  boxShadow: 'var(--modal-launch-shadow)',     /* Complex shadow from design system */
}}>
  {/* Content */}
</div>
```

**Key Changes**:
- Width now uses responsive modal width (scales automatically on mobile)
- Border uses modal-specific border color (from existing color system)
- Border radius uses design token
- Padding uses modal padding (which already responds to breakpoints)
- Z-index uses named variable
- Shadow uses complex modal shadow (maintains brand feel)

---

### Pattern 5: Grid Layout

**Component**: ShopItemCards.tsx or PromotionModal.tsx

#### BEFORE (Current):
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: window.innerWidth < 480 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
  gap: 10,
}}>
  {/* Items */}
</div>
```

#### AFTER (Using Design System + CSS Class):
```tsx
<div className="grid-auto-2-4" style={{ gap: 'var(--gap-md)' }}>
  {/* Items */}
</div>
```

Or add to index.css:
```css
/* CSS Grid Responsive Classes */
.grid-2-mobile-4-desktop {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--gap-md);
}

@media (max-width: 479px) {
  .grid-2-mobile-4-desktop {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-sm);
  }
}
```

**Key Changes**:
- Removed JavaScript viewport detection (less code, better performance)
- Uses CSS media queries
- Gap uses spacing system variable
- More maintainable and performant

---

## Phase 3: Refactoring Checklist

### Priority 1: High-Visibility Pages (Do First)
- [ ] **HomePage.tsx**
  - [ ] Profile card styling
  - [ ] "Play vs Jarvis" button
  - [ ] All font sizes to typography scale
  - [ ] All padding to spacing system

- [ ] **GameSetupModal.tsx**
  - [ ] Modal container styling
  - [ ] Button styling
  - [ ] Font sizes
  - [ ] Spacing between sections

### Priority 2: Modal Components (Do Second)
- [ ] **JarvisModal.tsx**
  - [ ] Modal width → --modal-width-md
  - [ ] Button heights → --button-height-md
  - [ ] Font sizes → typography scale
  - [ ] Padding → --modal-padding

- [ ] **GameResultModal.tsx**
  - [ ] Same as JarvisModal

- [ ] **PromotionModal.tsx**
  - [ ] Same as JarvisModal

### Priority 3: Card Components (Do Third)
- [ ] **BattleCard.tsx** — Font sizes, padding, spacing
- [ ] **ShopItemCards.tsx** — Grid gap, card padding, button styling
- [ ] **MiniProfileSheet.tsx** — Spacing, typography

### Priority 4: Layout Components (Do Last)
- [ ] **BottomNav.tsx** — Button heights, spacing
- [ ] **PageLayout.tsx** — Heading sizes, spacing
- [ ] **StatComponents.tsx** — Typography scale

---

## Pattern-by-Pattern Refactoring Map

### For Font Sizes
```
Hardcoded Value  →  Design Token              →  Size
10px             →  --font-size-xs            →  10px
11px             →  --font-size-sm            →  12px (or 11 on mobile)
12px             →  --font-size-sm            →  12px
13px             →  --font-size-base          →  14px (or 13 on mobile)
14px             →  --font-size-base          →  14px
16px             →  --font-size-md            →  16px
18px             →  --font-size-lg            →  18px
20px             →  --font-size-xl            →  20px
24px             →  --font-size-2xl           →  24px
```

### For Spacing
```
Hardcoded Value  →  Design Token              →  Size
4px              →  --gap-xs                  →  4px
6px              →  --gap-sm (or --space-s)  →  8px
8px              →  --gap-sm / --space-s     →  8px
10px             →  --gap-md                  →  12px (or 10 on mobile)
12px             →  --gap-md / --space-m     →  12px
14px             →  --gap-lg                  →  16px (or 14 on tablet)
16px             →  --gap-lg / --space-l     →  16px
20px             →  --button-padding-x-md    →  16px
24px             →  --gap-xl / --space-xl    →  24px
32px             →  --gap-2xl                 →  32px
48px             →  --gap-3xl                 →  48px
```

### For Border Radius
```
Hardcoded Value  →  Design Token              →  Size
8px              →  --radius-s                →  8px
12px             →  --radius-m                →  12px
16px             →  --radius-l                →  16px
20px             →  --radius-l                →  16px (use instead)
24px             →  --radius-xl               →  24px
9999px           →  --radius-round            →  9999px (circles)
```

### For Font Weights
```
Hardcoded Value  →  Design Token              →  Name
400              →  --font-weight-regular     →  Regular
500              →  --font-weight-medium      →  Medium
600              →  --font-weight-semibold    →  Semibold
700              →  --font-weight-bold        →  Bold
800              →  --font-weight-extrabold   →  Extra Bold
900              →  --font-weight-extrabold   →  Extra Bold
```

---

## Testing Refactored Components

### Step 1: Verify Typography
- [ ] Check font sizes look consistent across pages
- [ ] Check font weights are bold/semibold in right places
- [ ] Verify line heights are readable (not too tight)

### Step 2: Verify Spacing
- [ ] Check padding inside cards is consistent
- [ ] Check gaps between items are regular
- [ ] Check margins between sections are spacious
- [ ] Check mobile vs desktop spacing difference is noticeable

### Step 3: Verify Responsiveness
- Test at 320px (mobile):
  - [ ] Fonts aren't too large
  - [ ] Padding isn't excessive
  - [ ] Content fits without horizontal scroll
- Test at 480px (tablet):
  - [ ] Slightly more spacious than mobile
- Test at 768px+ (desktop):
  - [ ] Full spacing, lots of breathing room

### Step 4: Verify Colors
- Test light mode:
  - [ ] Text is readable
  - [ ] Contrast is good
  - [ ] Colors look intentional
- Test dark mode (default):
  - [ ] All colors render correctly
  - [ ] No hardcoded colors override variables

---

## Quick Reference: Common Replacements

### Typography
```tsx
// Before
{ fontSize: 12, fontWeight: 700 }

// After
{ fontSize: 'var(--label-font-size)', fontWeight: 'var(--font-weight-semibold)' }
```

### Cards
```tsx
// Before
{ padding: '16px', borderRadius: 12, gap: 12 }

// After
{ padding: 'var(--card-padding-lg)', borderRadius: 'var(--radius-m)', gap: 'var(--gap-md)' }
```

### Buttons
```tsx
// Before
{ padding: '20px', fontSize: 18, borderRadius: 16, height: 56 }

// After
{
  height: 'var(--button-height-lg)',
  paddingLeft: 'var(--button-padding-x-lg)',
  paddingRight: 'var(--button-padding-x-lg)',
  fontSize: 'var(--font-size-lg)',
  borderRadius: 'var(--radius-l)'
}
```

### Modals
```tsx
// Before
{ maxWidth: 480, padding: 24, borderRadius: 20 }

// After
{
  maxWidth: 'var(--modal-width-lg)',
  padding: 'var(--modal-padding)',
  borderRadius: 'var(--radius-l)'
}
```

---

## Commit Strategy

After adding DESIGN_TOKENS.css to index.css:

```
1. feat(design): add typography and component sizing tokens to index.css
   - Added --font-size-* (semantic typography scale)
   - Added --font-weight-* (semantic font weight names)
   - Added --button-height-*, --card-padding-*, --modal-width-* (component sizes)
   - Added responsive typography scaling at breakpoints
   - Added utility classes for quick styling

2. refactor(design): update HomePage.tsx to use design system tokens
   - Replace hardcoded font sizes with CSS variables
   - Replace hardcoded padding/margin with spacing system
   - Replace hardcoded colors with CSS variables
   - Add proper line heights and letter spacing

3. refactor(design): update GameSetupModal.tsx to use design system tokens
   - Replace modal sizing with --modal-width-* variables
   - Replace button padding with --button-padding-* variables
   - Replace typography with semantic variables

... (one commit per component or logical group)
```

---

## Success Criteria

### When Design System is "Active"
1. ✅ All components use CSS variables (not hardcoded px values)
2. ✅ Typography is consistent across pages (same font sizes used consistently)
3. ✅ Spacing is consistent (cards all have same padding, buttons all have same height)
4. ✅ Responsive design works (mobile is cramped, desktop is spacious)
5. ✅ Light mode works (all variables adapt via CSS)
6. ✅ Visual hierarchy is clear (headings > subheadings > body)
7. ✅ No magic numbers in inline styles (everything references a variable)

### Visual Tests Pass
- [ ] HomePage looks professional (clean spacing, consistent text sizes)
- [ ] All modals look unified (same padding, corner radius, sizing)
- [ ] Buttons are consistently sized (all are 44px or larger for touch)
- [ ] Cards have matching padding and spacing
- [ ] Mobile layout is clean (nothing cramped)
- [ ] Desktop layout is spacious (proper breathing room)

---

## Next Steps

1. **Add DESIGN_TOKENS.css content to index.css**
   - Copy everything into index.css between color variables and responsive breakpoints
   - Test that no CSS errors appear

2. **Start refactoring HomePage.tsx**
   - This is the most visible page
   - Once it looks good, the user will see immediate improvement
   - Use patterns above as template

3. **Refactor GameSetupModal.tsx**
   - Second most visible component
   - User interacts with this frequently
   - Will show the system works

4. **Continue systematically through other components**
   - Use the Priority Checklist above
   - Test responsiveness at each step
   - One component at a time to catch issues early

This is the path to turning ChessCoin from "looks broken" to "looks professional."
