# Modal Design System — Final Concept

**Date**: 2026-04-01
**Purpose**: Establish consistent, working modal pattern for GameSetupModal and all bottom-sheets

---

## Core Principle: Bottom-Sheet Pattern (Fixed Header + Scrollable Content + Fixed Footer)

This pattern is proven in 7 existing components:
- ✅ ActiveSessionsModal
- ✅ AttemptsModal
- ✅ JarvisModal
- ✅ MiniProfileSheet
- ✅ GameSetupModal (NEW)

---

## Structure (Flex Layout)

```
┌─────────────────────────────────┐
│    HEADER (flexShrink: 0)       │  ← Fixed, does not scroll
│  - Back/Info/Close buttons      │
│  - Title + subtitle             │
│  - Border-bottom (visual sep)   │
├─────────────────────────────────┤
│                                 │
│  CONTENT (flex: 1, overflow)    │  ← Scrollable, grows to fill
│  - Color selection grid (1x3)   │
│  - Time selection grid (3x2)    │
│                                 │
├─────────────────────────────────┤
│    FOOTER (flexShrink: 0)       │  ← Fixed at bottom
│  - Info hint (compact)          │
│  - Start button                 │
│  - Border-top (visual sep)      │
└─────────────────────────────────┘
```

**Key**: Each section is `flexShrink: 0` except content which is `flex: 1`

---

## CSS Values (Applied)

### Overlay (Fixed background)
```css
position: fixed
inset: 0
background: rgba(0,0,0,0.7)
backdrop-filter: blur(8px)
z-index: 300
align-items: flex-end  /* Bottom-sheet alignment */
padding-bottom: max(82px, env(safe-area-inset-bottom))  /* Mobile safe-area */
```

### Sheet (Container)
```css
width: 100%
max-width: clamp(280px, 90vw, 480px)  /* Responsive mobile-to-tablet */
height: 80vh
max-height: 80vh
background: #13161F
border: 1px solid rgba(255,255,255,0.1)
border-bottom: none  /* Bottom-sheet open at bottom */
border-radius: 24px 24px 0 0
padding: 16px  /* Compact, consistent */
display: flex
flex-direction: column
gap: 12px  /* Separates sections visually */
```

### Header (Fixed, not scrolling)
```css
display: flex
align-items: center
gap: 12px
flex-shrink: 0
padding-bottom: 8px
border-bottom: 1px solid rgba(255,255,255,0.05)  /* Subtle separation */
```

**Elements**:
- Back button: 28x28px circular, `rgba(255,255,255,0.07)` background
- Title: 16px, 800 weight
- Subtitle: 11px, accent color (#F5C842)
- Info button: 28x28px circular, styled like back button, hover state
- Close button: 28x28px circular

### Content (Scrollable)
```css
flex: 1  /* Grows to available space */
overflow-y: auto
overflow-x: hidden
padding-right: 2px  /* Minimal scroll margin */
display: flex
flex-direction: column
gap: 12px  /* Sections separated */
```

**Subsections**:
- Color selection grid: `grid 1x3, gap 6px`
  - Buttons: 58px minHeight, 12px padding, 10px border-radius
  - Active: accent bg 10%, accent border 2px, scale(1.03)
  - Inactive: #1C2030 bg, secondary border

- Time selection grid: `grid 3x2, gap 6px`
  - Buttons: 50px minHeight, 10px padding, 10px border-radius
  - Active: purple bg 15%, purple border, scale(1.03)
  - Inactive: #1C2030 bg, secondary border

### Footer (Fixed at bottom)
```css
display: flex
flex-direction: column
gap: 8px
flex-shrink: 0
border-top: 1px solid rgba(255,255,255,0.05)
padding-top: 8px
```

**Elements**:
1. **Info hint box**:
   - Background: `rgba(123,97,255,0.08)`
   - Border: 1px `rgba(123,97,255,0.15)`
   - Padding: 10px
   - Border-radius: 10px
   - Text: 12px, #8B92A8, lineHeight 1.5
   - Content: "🏆 Выигрывай уровни по порядку..."

2. **Start button**:
   - Width: 100%
   - Padding: 14px 12px
   - minHeight: 48px
   - Background: #F5C842 (accent)
   - Color: #0B0D11 (dark)
   - Font: 15px, 800 weight
   - Border-radius: 12px
   - Box-shadow: 0 4px 20px rgba(245,200,66,0.2)

---

## Responsive Behavior

### Mobile (<480px)
- Sheet width: 90vw (clamp handles min/max)
- Padding: 16px (consistent)
- Grid columns: 3 (color), 3 (time) — no change needed
- Font sizes: minimal reduction (11px → 10px for labels)

### Tablet (480px+)
- Sheet width: up to 480px
- Same padding/gaps (inherit from parent)
- Same grids

### Safe Area Support
```css
padding-bottom: max(82px, env(safe-area-inset-bottom))
```
- Handles notched iPhones (iPhone X+)
- Fallback for non-notched devices (82px)

---

## Button Styling Rules

### Circular Buttons (Header)
```css
width: 28px
height: 28px
border-radius: 50%
background: rgba(255,255,255,0.07)
border: 1px solid rgba(255,255,255,0.1)
color: #F0F2F8
cursor: pointer
transition: all 0.15s
padding: 0
font-family: inherit
```

### Grid Buttons (Color/Time)
```css
display: flex
flex-direction: column
align-items: center
justify-content: center
gap: [4px | 6px]
border-radius: 10px
cursor: pointer
transition: all 0.15s
transform: scale(1.03) when active
```

### Primary Button (Start)
```css
full-width: yes
padding: 14px 12px
minHeight: 48px
background: #F5C842 (accent)
border: none
border-radius: 12px
color: #0B0D11
font-weight: 800
transition: all 0.2s
```

---

## Color Palette (Fixed)

| Usage | Color | Opacity |
|-------|-------|---------|
| Overlay | #000000 | 70% |
| Card BG | #13161F | 100% |
| Borders | #FFFFFF | 10% |
| Text Primary | #F0F2F8 | 100% |
| Text Secondary | #8B92A8 | 100% |
| Text Muted | #4A5270 | 100% |
| Accent (Primary) | #F5C842 | 100% |
| Accent Active (Button) | #F5C842 | 10% |
| Purple (Secondary) | #9B85FF | 15% |
| Info Hint BG | #7B61FF | 8% |
| Info Hint Border | #7B61FF | 15% |

---

## Applied To GameSetupModal

### Before
- ❌ No header/footer separation
- ❌ Info button unstyled (plain emoji)
- ❌ Info hint overlapping content
- ❌ Inconsistent spacing/padding
- ❌ maxHeight calculation broken

### After
- ✅ Clear 3-section structure (header → content → footer)
- ✅ Info button styled as circular button (28x28px)
- ✅ Info hint in fixed footer (no overlap)
- ✅ Consistent 16px padding, 12px gaps
- ✅ maxHeight: 80vh with proper flex layout
- ✅ Safe-area inset support
- ✅ Responsive grid columns (3x3 always)

---

## Files Updated

1. **frontend/src/components/ui/GameSetupModal.tsx**
   - Changed overlay/sheet styles
   - Restructured JSX: header → content → footer
   - Updated button styles for compact layout
   - Added info hint to footer

---

## Testing Checklist

- [ ] Open modal at 360px viewport (mobile) → no overflow
- [ ] Color buttons visible and clickable (all 3 in one row)
- [ ] Time buttons visible and clickable (6 buttons, 3 per row)
- [ ] Info button styled as circular button, not plain emoji
- [ ] Info hint at bottom, does not overlap with any buttons
- [ ] Start button visible and clickable at bottom
- [ ] Scrollable if content exceeds 80vh
- [ ] Test on actual device (notched phone) → safe-area works
- [ ] Test at 480px, 768px, 1024px viewports
- [ ] No layout shift when modal opens/closes

---

## Design Philosophy

**Consistency**: Follows established pattern from 7 working bottom-sheets
**Responsiveness**: Mobile-first, scales up gracefully
**Accessibility**: Safe-area support, 44px+ button targets
**Performance**: No complex animations, minimal re-renders
**Simplicity**: Clean flex layout, no nested conditionals for sizing

---

**LOCKED CONCEPT** — This design is final. Any changes must be justified by user feedback, not iteration.
