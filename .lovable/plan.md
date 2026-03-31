

# Fix — Filtro de categorias usando custom_categories do banco

## Problem
Both ExpensesPage and RevenuesPage have hardcoded `categoryOptions`/`sourceOptions` arrays used in:
1. Filter dropdown comparison (line 127/123: compares `expense.category` against slug values that may not match DB records)
2. Table display (line 410/403: uses hardcoded `categoryOptions.find()` to show badge, missing DB categories)
3. Inline edit dropdown (line 420/413: iterates over hardcoded list)

The `allCategoryOptions`/`allSourceOptions` (built from DB) exist but aren't used everywhere.

## Changes

### 1. `src/pages/ExpensesPage.tsx`

**Add `getCategoryDisplay` helper** that finds category by matching slug, name, or lowercase name against `allCategoryOptions`:
```ts
const getCategoryDisplay = (catValue: string) => {
  const cat = allCategoryOptions.find(c => c.value === catValue || c.name.toLowerCase() === catValue?.toLowerCase() || c.name === catValue);
  return { emoji: cat?.emoji ?? "📦", name: cat?.name ?? catValue, label: cat?.label ?? catValue };
};
```

**Fix filter logic** (line 127): when `filterCategory !== "all"`, find the selected option from `allCategoryOptions` and compare using both slug and name variations:
```ts
if (filterCategory !== "all") {
  const selectedCat = allCategoryOptions.find(c => c.value === filterCategory);
  if (selectedCat) {
    data = data.filter(e => e.category === filterCategory || e.category === selectedCat.name || e.category?.toLowerCase() === selectedCat.name.toLowerCase());
  } else {
    data = data.filter(e => e.category === filterCategory);
  }
}
```

**Fix table badge display** (line 410/425): replace `categoryOptions.find()` with `getCategoryDisplay()`:
```tsx
const { emoji, name, label } = getCategoryDisplay(expense.category);
// Badge: <WtBadge>{label}</WtBadge>
```

**Fix inline edit dropdown** (line 420): use `allCategoryOptions` instead of `categoryOptions`

**Remove** the hardcoded `categoryOptions` array (lines 22-36) and `catColors` (lines 38-42) — derive colors from DB `custom_categories.color` field.

### 2. `src/pages/RevenuesPage.tsx`

Same pattern:
- Add `getSourceDisplay` helper using `allSourceOptions`
- Fix filter logic (line 123) with slug+name matching
- Fix table badge (line 403/418): use `allSourceOptions` lookup instead of hardcoded `sourceOptions`
- Fix inline edit dropdown (line 413): use `allSourceOptions`
- Remove hardcoded `sourceOptions` array (lines 22-32)

### 3. Chart colors
For the PieChart/BarChart in both pages, derive colors from `custom_categories.color` field instead of hardcoded `catColors`/`sourceColors`.

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ExpensesPage.tsx` | Remove hardcoded arrays, use DB categories everywhere |
| `src/pages/RevenuesPage.tsx` | Remove hardcoded arrays, use DB categories everywhere |

