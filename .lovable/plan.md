

# Show Ocupadas/Manutenção/Vacâncias as plain numbers

The three KPI cards (Ocupadas, Manutenção, Vacâncias) currently display as currency (R$) because `formatAs` defaults to `'currency'`. Add `formatAs="number"` to each.

## Changes

**`src/pages/KitnetsPage.tsx`** (lines 88-90):
```tsx
<KpiCard label="Ocupadas" value={summary.occupied} color="green" compact formatAs="number" />
<KpiCard label="Manutenção" value={summary.maintenance} color="cyan" compact formatAs="number" />
<KpiCard label="Vacâncias" value={summary.vacant} color="red" compact formatAs="number" />
```

Same change in **`src/pages/ManagerKitnetsPage.tsx`** (lines 87-89).

| File | Action |
|------|--------|
| `src/pages/KitnetsPage.tsx` | Add `formatAs="number"` to 3 KPI cards |
| `src/pages/ManagerKitnetsPage.tsx` | Add `formatAs="number"` to 3 KPI cards |

