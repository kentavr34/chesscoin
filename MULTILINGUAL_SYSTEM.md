# ChessCoin Multi-Language System (10-я функция)
**Date:** 2026-03-31
**Status:** 🔧 Infrastructure Complete, Components Partially Migrated

---

## 📋 Overview

The multi-language system ensures that **100% of UI text changes when the user switches language** from Settings → Profile. Currently supports **Russian (RU) and English (EN)**.

### Current Requirement:
> "Многоязычный интерфейс - все названия, кнопок, страниц, подсказок, уведомлений, инструкций, званий, приветственного текста в боте - везде менять язык при смене языка из настоек в профиле"
>
> "It is unacceptable that even player status or rank use words and letters of a different language anywhere."

### Key Changes in This Session:
✅ All Jarvis levels (20 levels) moved to translations
✅ All referral ranks (18 ranks) moved to translations
✅ Created `useJarvisLevels()` hook for localized access
✅ Created `useReferralRanks()` hook for localized access
✅ Updated `JarvisModal.tsx` to use localized levels
✅ Updated `ReferralsPage.tsx` to use localized ranks

---

## 🏗️ System Architecture

### 1. Translations File Structure
**File:** `frontend/src/i18n/translations.ts`

```typescript
export const translations = {
  en: {
    // ...
    jarvis: {
      levels: [
        { name: 'Beginner' },    // index 0 = level 1
        { name: 'Rookie' },      // index 1 = level 2
        // ... 20 levels total
      ]
    },
    referrals: {
      ranks: [
        { label: 'Emperor' },       // index 0 = highest rank
        { label: 'Marshal' },       // index 1
        // ... 18 ranks total
      ]
    }
  },
  ru: {
    // ...
    jarvis: {
      levels: [
        { name: 'Новичок' },    // index 0 = уровень 1
        { name: 'Молодой боец' }, // index 1 = уровень 2
        // ... 20 уровней всего
      ]
    },
    referrals: {
      ranks: [
        { label: 'Император' },          // index 0 = наивысший ранг
        { label: 'Маршал' },            // index 1
        // ... 18 рангов всего
      ]
    }
  }
}
```

---

## 🪝 Custom Hooks

### `useJarvisLevels()`
**File:** `frontend/src/hooks/useJarvisLevels.ts`

```typescript
// Get all 20 levels with localized names
const levels = useJarvisLevels();

// Get name for specific level
const name = getJarvisLevelName(t, 5); // "Fighter" or "Боец"

// Find level data by translated name
const level = findJarvisLevelByName(t, 'Champion');
```

**Used in:**
- `JarvisModal.tsx` ✅ Updated
- `HomePage.tsx` ⏳ Needs update
- `GamePage.tsx` ⏳ Needs update
- `ProfilePage.tsx` ⏳ Needs update
- `BadgeDetailModal.tsx` ⏳ Needs update

### `useReferralRanks()`
**File:** `frontend/src/hooks/useReferralRanks.ts`

```typescript
// Get all 18 ranks with localized labels
const ranks = useReferralRanks();

// Get label for specific rank code
const label = getRankLabel(t, 'CAPTAIN'); // "Captain" or "Капитан"

// Find rank by referral count
const rank = findRankByReferralCount(ranks, 5000);
```

**Used in:**
- `ReferralsPage.tsx` ✅ Updated (partially)
- Other components referencing ranks ⏳ Needs update

---

## 🔄 Migration Checklist

### ✅ COMPLETED
1. [x] Move Jarvis levels to translations.ts (EN + RU)
2. [x] Move referral ranks to translations.ts (EN + RU)
3. [x] Create useJarvisLevels() hook
4. [x] Create useReferralRanks() hook
5. [x] Update JarvisModal.tsx rendering
6. [x] Update ReferralsPage.tsx rendering

### ⏳ TODO - Component Migrations
1. [ ] **GamePage.tsx** — Use useJarvisLevels() for bot level name display
   ```typescript
   // Current: botLevelName={JARVIS_LEVELS[...].name}
   // Replace with: const levels = useJarvisLevels()
   ```

2. [ ] **HomePage.tsx** — Use useJarvisLevels() for Jarvis card
   ```typescript
   // Current: const jarvisCfg = JARVIS_LEVELS[...]
   // Replace with: const levels = useJarvisLevels()
   ```

3. [ ] **ProfilePage.tsx** — Use useJarvisLevels() for level display + badges
   ```typescript
   // Current: {JARVIS_LEVELS[...].name}
   // Replace with: const levels = useJarvisLevels()
   ```

4. [ ] **BadgeDetailModal.tsx** — Fix level lookup by name
   ```typescript
   // Current: const lvlData = JARVIS_LEVELS.find(l => l.name === badgeName)
   // Issue: names are now localized, won't match
   // Solution: Either:
   //   a) Pass level number instead of name to modal
   //   b) Use findJarvisLevelByName(t, badgeName) from hook
   ```

5. [ ] **Bot Messages** — Translate bot welcome text, commands
   - Currently: `bot/src/handlers/` may have hardcoded English
   - Solution: Use i18n in bot code (if using same translations)

6. [ ] **Game Status Messages** — Translate game state messages
   - "Your turn", "Opponent's turn", etc. should already be in translations
   - Search for any hardcoded status strings

---

## 🛠️ How to Use in Components

### Before (Hardcoded English):
```typescript
const JARVIS_LEVELS = [
  { name: 'Beginner', reward: 1000 },
  { name: 'Rookie', reward: 2000 },
];

export function MyComponent() {
  return <div>{JARVIS_LEVELS[0].name}</div>;  // Always "Beginner"
}
```

### After (Localized):
```typescript
import { useJarvisLevels } from '@/hooks/useJarvisLevels';

export function MyComponent() {
  const levels = useJarvisLevels();  // "Beginner" or "Новичок" based on language
  return <div>{levels[0].name}</div>;
}
```

---

## 📱 Bot Integration

The Telegram bot (`bot/src/`) may also need translation support. Check:
- `/start` message
- Command descriptions
- Game notifications
- Referral messages

**Solution:** Either:
1. Create `bot/src/i18n.ts` with same translations
2. Or fetch translations from backend API

---

## 🔐 Data Consistency

### Issue: Badges stored with localized names
When a user completes a Jarvis level, the badge is saved with the level name at that moment. If they later switch language:
```
User completes level 5 in English → stored as "Fighter"
User switches to Russian
Lookup fails because badge says "Fighter" but translation says "Боец"
```

### Solution: Store badges by level number, not name
Update database schema:
```typescript
// Before
badge { name: "Fighter", date: "2026-03-31" }

// After
badge { jarvisLevel: 5, date: "2026-03-31" }
```

---

## ✨ Complete Multi-Language Checklist

- [x] Jarvis levels in translations
- [x] Referral ranks in translations
- [x] Hooks for accessing localized data
- [ ] All components using hooks
- [ ] Bot messages translated
- [ ] Game status messages translated
- [ ] Badges refactored to use level numbers
- [ ] Settings page language toggle visible
- [ ] All in-game text switches language
- [ ] Tested: change language → UI updates completely
- [ ] Tested: refresh page → correct language persists
- [ ] Tested: different users see correct language

---

## 🧪 Testing Language Switching

```
1. Open Settings → Language
2. Switch from English to Russian
3. Verify ALL text changes:
   - Page headers
   - Button text
   - Jarvis levels
   - Referral ranks
   - Error messages
   - Notifications
   - Game status
4. Switch back to English
5. Verify all text reverts
6. Refresh page
7. Verify language persists
```

---

## 🎯 Critical Notes

1. **No mixed languages** — If even ONE string is hardcoded in English, it breaks the requirement
2. **All user-facing text** must come from `translations.ts` or be generated from it
3. **Rank/Level names** are stored in database — must handle gracefully across language changes
4. **Bot messages** must also be localized when possible
5. **Fallback behavior** — if translation missing, show level number instead of empty

---

## 📞 Summary for Developer

The multilingual infrastructure is now in place. All that remains is:
1. **Migrate components** to use the new hooks (5-6 files)
2. **Fix badge storage** to use level numbers instead of names
3. **Translate bot messages** (if applicable)
4. **Test thoroughly** that changing language updates 100% of UI

This is the final piece to ensure "no Russian/English mixed language anywhere" ✅
