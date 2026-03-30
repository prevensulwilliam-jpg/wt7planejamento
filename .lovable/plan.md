

# Rename — Wisely → Naval em todo o sistema

## Summary
Global find-and-replace of "Wisely" → "Naval" across 7 files, plus renaming 3 files. Edge function file stays as `wisely-ai` to preserve the Supabase integration.

## Changes

### 1. Rename files
- `src/components/wt7/WiselyChat.tsx` → `src/components/wt7/NavalChat.tsx`
- `src/hooks/useWisely.ts` → `src/hooks/useNaval.ts`
- `src/pages/WiselyPage.tsx` → `src/pages/NavalPage.tsx`

### 2. `src/components/wt7/NavalChat.tsx` (was WiselyChat.tsx)
- `export function WiselyChat` → `export function NavalChat`
- All UI strings "Wisely" → "Naval" (FAB label, header, footer hint)

### 3. `src/hooks/useNaval.ts` (was useWisely.ts)
- `useWiselyContext` → `useNavalContext`
- `useWiselyAnalysis` → `useNavalAnalysis`
- `useWiselyChat` → `useNavalChat`
- `useWiselyInsight` → `useNavalInsight`
- `callWisely` → `callNaval`
- Console error strings "Wisely" → "Naval"

### 4. `src/pages/NavalPage.tsx` (was WiselyPage.tsx)
- Import path `@/hooks/useWisely` → `@/hooks/useNaval`
- Hook names: `useWiselyAnalysis/Chat/Insight` → `useNavalAnalysis/Chat/Insight`
- UI strings: "Wisely IA" → "Naval", "Pergunte ao Wisely" → "Pergunte ao Naval", placeholder text
- Badge: "powered by AI" → "powered by AI · Naval Ravikant inspired"
- Export: `WiselyPage` → `NavalPage`

### 5. `src/components/wt7/AdminSidebar.tsx`
- `label: "Wisely IA"` → `label: "Naval"`
- `href: "/wisely"` → `href: "/naval"`

### 6. `src/App.tsx`
- `import WiselyPage` → `import NavalPage from "@/pages/NavalPage"`
- `path="/wisely"` → `path="/naval"`
- `element={<WiselyPage />}` → `element={<NavalPage />}`

### 7. `src/pages/DashboardPage.tsx`
- Import: `useWiselyAnalysis` → `useNavalAnalysis` from `@/hooks/useNaval`
- `WiselyDashboardCard` → `NavalDashboardCard`
- "WISELY —" → "NAVAL —"
- `navigate('/wisely')` → `navigate('/naval')`
- "Wisely →" → "Naval →"

### 8. `src/layouts/AdminLayout.tsx`
- Import: `WiselyChat` → `NavalChat` from `@/components/wt7/NavalChat`
- `<WiselyChat />` → `<NavalChat />`

### 9. `supabase/functions/wisely-ai/index.ts`
- "Você é o Wisely" → "Você é o Naval"
- "assistente financeiro pessoal" → "conselheiro financeiro estratégico"
- Keep filename and function name as `wisely-ai`

## Files Changed
| File | Action |
|------|--------|
| `src/components/wt7/NavalChat.tsx` | Create (rename from WiselyChat.tsx) |
| `src/hooks/useNaval.ts` | Create (rename from useWisely.ts) |
| `src/pages/NavalPage.tsx` | Create (rename from WiselyPage.tsx) |
| `src/components/wt7/AdminSidebar.tsx` | Edit sidebar link |
| `src/App.tsx` | Edit route + import |
| `src/pages/DashboardPage.tsx` | Edit import + strings |
| `src/layouts/AdminLayout.tsx` | Edit import + component |
| `supabase/functions/wisely-ai/index.ts` | Edit system prompt only |

