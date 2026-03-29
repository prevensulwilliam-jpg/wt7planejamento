

# Feature — Sistema de Aprendizado de Padrões de Classificação

## Summary
Create `classification_patterns` table, new `patternLearning.ts` lib, new `PatternsPage.tsx`, and update `ReconciliationPage.tsx` to learn from manual classifications and apply learned patterns during import preview.

---

## 1. Database Migration
Create `classification_patterns` table with columns: `id`, `description_pattern`, `category`, `intent`, `label`, `count`, `auto_apply`, `created_at`, `updated_at`. Unique on `(description_pattern, category, intent)`. RLS: admin-only policy using `has_role()`.

## 2. New File: `src/lib/patternLearning.ts`
- `normalizeDescription()` — strips accents, dates, currency, long numbers, normalizes whitespace, max 60 chars
- `findLearnedPattern()` — queries `auto_apply=true` patterns, matches by substring inclusion
- `getAllPatterns()` — bulk fetch for preview use
- `recordClassification()` — upsert pattern, set `auto_apply=true` when count ≥ 3
- `removePattern()` / `updatePattern()` — CRUD helpers

## 3. Update `src/pages/ReconciliationPage.tsx`

### 3a. Export constants
Add `export` to `ALL_CATEGORY_LABELS` and re-export `INTENT_CONFIG` from categorizeTransaction.

### 3b. Update `handleFile` in ImportTab (lines 157-193)
- Make callback `async`
- Call `getAllPatterns()` before categorizing
- For each transaction: try learned pattern match first (flag `_learned: true, _learnedCount`), fallback to `categorizeTransaction()`

### 3c. Add learned badge in preview list (line ~318-322)
Show purple "🧠 Nx" badge when `tx._learned` is true.

### 3d. Update `classifyAs` (lines 447-487)
After successful classification (revenue/expense/transfer), call `recordClassification()` to register the pattern.

### 3e. Update `confirmAllAuto` (lines 489+)
After confirming each auto-categorized transaction, call `recordClassification()`.

## 4. New File: `src/pages/PatternsPage.tsx`
- Query `classification_patterns` table
- Split into "Automáticos" (auto_apply=true) and "Aprendendo" sections
- KPI cards: auto count, learning count, total
- Table with pattern, category, intent badge, count, delete button
- Progress bar for learning patterns (count/3)
- Uses PremiumCard, WtBadge, GoldButton, Table, AlertDialog

## 5. Route & Sidebar
- `App.tsx`: import PatternsPage, add `<Route path="/patterns" element={<PatternsPage />} />` inside admin layout
- `AdminSidebar.tsx`: add `{ label: "Padrões IA", icon: Brain, href: "/patterns" }` in "RECEITAS & DESPESAS" group after Conciliação

## Files Changed
| File | Action |
|------|--------|
| DB migration | Create `classification_patterns` table + RLS |
| `src/lib/patternLearning.ts` | New file — pattern learning utilities |
| `src/pages/ReconciliationPage.tsx` | Export constants, async handleFile with pattern lookup, learned badge, recordClassification in classifyAs/confirmAllAuto |
| `src/pages/PatternsPage.tsx` | New file — pattern management page |
| `src/App.tsx` | Add PatternsPage route |
| `src/components/wt7/AdminSidebar.tsx` | Add Padrões IA nav item |

