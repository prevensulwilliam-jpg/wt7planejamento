

# Fix — Adicionar Gás e Aluguel

## Changes

### 1. `src/lib/categoryMap.ts`
Add two entries to `EXPENSE_CATEGORY_MAP`:
- `gas: { emoji: "🔥", name: "Gás", color: "#F97316" }`
- `aluguel: { emoji: "🏠", name: "Aluguel", color: "#F43F5E" }`

### 2. `src/lib/categorizeTransaction.ts`
- Add `"gas", "aluguel"` to `FIXED_CATEGORIES` array
- Add two rules to `EXPENSE_RULES`:
  - `{ keywords: ["supergasbras", "gas encanado", "comgas"], category: "gas", label: "Gás" }`
  - `{ keywords: ["pjbank", "pj bank"], category: "aluguel", label: "Aluguel" }`

## Files Changed
| File | Action |
|------|--------|
| `src/lib/categoryMap.ts` | Add 2 entries to EXPENSE_CATEGORY_MAP |
| `src/lib/categorizeTransaction.ts` | Add to FIXED_CATEGORIES + EXPENSE_RULES |

