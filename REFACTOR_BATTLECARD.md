# BattleCard Refactoring Plan

**File:** `frontend/src/components/ui/BattleCard.tsx`
**Status:** 148 lines, FULL of window.innerWidth checks
**Priority:** HIGH (component used everywhere)

---

## Problem
Lines 83, 88, 91, 92, 99, 100, 106, 112, 114, 116, 122, 125, 136, 140 all use:
```typescript
window.innerWidth < 480 ? mobileValue : desktopValue
```

This is:
- ❌ Not performant (evaluates on every render)
- ❌ Hard to maintain (scattered throughout)
- ❌ Not responsive (doesn't update on window resize properly)
- ❌ Against CSS best practices

---

## Solution Pattern

### Step 1: Add CSS media query utilities to index.css

```css
/* BattleCard responsive sizing */
:root {
  --battle-card-player-width: 52px;
  --battle-card-player-gap: 4px;
  --battle-card-center-gap: 8px;
  --battle-card-emoji-size: 18px;
  --battle-card-status-size: 10px;
  --battle-card-button-padding: 4px 8px;
  --battle-card-button-gap: 4px;
  --battle-card-name-size: 9px;
  --battle-card-flag-size: 12px;
  --battle-card-label-size: 9px;
}

@media (max-width: 479px) {
  :root {
    --battle-card-player-width: 40px;
    --battle-card-player-gap: 2px;
    --battle-card-center-gap: 4px;
    --battle-card-emoji-size: 14px;
    --battle-card-status-size: 9px;
    --battle-card-button-padding: 2px 6px;
    --battle-card-button-gap: 2px;
    --battle-card-name-size: 8px;
    --battle-card-flag-size: 10px;
    --battle-card-label-size: 8px;
  }
}
```

### Step 2: Replace all window.innerWidth ternaries

**Line 73:**
```typescript
// BEFORE:
padding: compact ? '8px 0' : '12px 0',

// AFTER:
padding: compact ? `var(--space-sm) 0` : `var(--card-padding-md) 0`,
```

**Line 77:**
```typescript
// BEFORE:
fontSize: 9, color: 'var(--color-text-muted, #4A5270)', letterSpacing: '.06em'

// AFTER:
fontSize: 'var(--battle-card-label-size)', color: 'var(--color-text-muted, #4A5270)', letterSpacing: '.06em'
```

**Line 83:**
```typescript
// BEFORE:
gap: window.innerWidth < 480 ? 4 : 8

// AFTER:
gap: 'var(--battle-card-center-gap)'
```

**Line 88:**
```typescript
// BEFORE:
width: window.innerWidth < 480 ? 40 : 52

// AFTER:
width: 'var(--battle-card-player-width)'
```

**Line 91:**
```typescript
// BEFORE:
fontSize: window.innerWidth < 480 ? 10 : 12

// AFTER:
fontSize: 'var(--battle-card-flag-size)'
```

**Line 92:**
```typescript
// BEFORE:
fontSize: window.innerWidth < 480 ? 8 : 9, color: p1Color, fontWeight: 700, textAlign: 'center', maxWidth: window.innerWidth < 480 ? 40 : 52

// AFTER:
fontSize: 'var(--battle-card-name-size)', color: p1Color, fontWeight: 700, textAlign: 'center', maxWidth: 'var(--battle-card-player-width)'
```

**Line 99:**
```typescript
// BEFORE:
fontSize: window.innerWidth < 480 ? 14 : 18

// AFTER:
fontSize: 'var(--battle-card-emoji-size)'
```

**Line 100:**
```typescript
// BEFORE:
fontSize: window.innerWidth < 480 ? 9 : 10

// AFTER:
fontSize: 'var(--battle-card-status-size)'
```

**Line 112:**
```typescript
// BEFORE:
gap: window.innerWidth < 480 ? 2 : 4

// AFTER:
gap: 'var(--battle-card-button-gap)'
```

**Line 116:**
```typescript
// BEFORE:
padding: window.innerWidth < 480 ? '2px 6px' : '4px 8px', background: 'var(--battle-card-spectate-bg, rgba(245,200,66,0.1))', color: 'var(--color-accent, #F5C842)', border: `1px solid var(--battle-card-spectate-border, rgba(245,200,66,0.25))`, borderRadius: 7, fontSize: window.innerWidth < 480 ? 9 : 10

// AFTER:
padding: 'var(--battle-card-button-padding)', background: 'var(--battle-card-spectate-bg, rgba(245,200,66,0.1))', color: 'var(--color-accent, #F5C842)', border: `1px solid var(--battle-card-spectate-border, rgba(245,200,66,0.25))`, borderRadius: 'var(--radius-sm)', fontSize: 'var(--battle-card-status-size)'
```

**Line 125:**
```typescript
// BEFORE:
padding: window.innerWidth < 480 ? '2px 6px' : '4px 8px', background: 'var(--battle-card-save-bg, rgba(123,97,255,0.12))', color: 'var(--battle-card-save-color, #9B85FF)', border: `1px solid var(--battle-card-save-border, rgba(123,97,255,0.25))`, borderRadius: 7, fontSize: window.innerWidth < 480 ? 9 : 10

// AFTER:
padding: 'var(--battle-card-button-padding)', background: 'var(--battle-card-save-bg, rgba(123,97,255,0.12))', color: 'var(--battle-card-save-color, #9B85FF)', border: `1px solid var(--battle-card-save-border, rgba(123,97,255,0.25))`, borderRadius: 'var(--radius-sm)', fontSize: 'var(--battle-card-status-size)'
```

**Line 136:**
```typescript
// BEFORE:
width: window.innerWidth < 480 ? 40 : 52

// AFTER:
width: 'var(--battle-card-player-width)'
```

**Line 139:**
```typescript
// BEFORE:
fontSize: window.innerWidth < 480 ? 10 : 12

// AFTER:
fontSize: 'var(--battle-card-flag-size)'
```

**Line 140:**
```typescript
// BEFORE:
fontSize: window.innerWidth < 480 ? 8 : 9, color: p2Color, fontWeight: 700, textAlign: 'center', maxWidth: window.innerWidth < 480 ? 40 : 52

// AFTER:
fontSize: 'var(--battle-card-name-size)', color: p2Color, fontWeight: 700, textAlign: 'center', maxWidth: 'var(--battle-card-player-width)'
```

---

## Result
✅ Zero `window.innerWidth` checks
✅ All responsive values in CSS (can change in one place)
✅ Proper CSS media queries (responsive on window resize)
✅ All design tokens used consistently
✅ Much easier to maintain

---

## Time Estimate
- Add CSS media queries to index.css: 5 minutes
- Replace all window.innerWidth ternaries in BattleCard: 10 minutes
- Test responsive behavior: 5 minutes
- **Total: 20 minutes**

---

## After Completion
Apply the same pattern to other components:
- JarvisModal (also many window.innerWidth checks)
- GameResultModal
- ShopItemCards
- And others...
