

# Feature — Wisely Chat Flutuante Global

## Summary
Create a floating chat widget accessible from all pages, with page-aware context fetching from the database. Update the edge function system prompt. Remove the standalone Wisely button from the Dashboard.

## Changes

### 1. New file: `src/components/wt7/WiselyChat.tsx`
Full floating chat component as specified:
- `fetchPageContext(pathname)` — queries relevant tables based on current route
- FAB button (gold gradient, bottom-right corner)
- Chat window with header, messages area, suggestion chips, input
- Uses `supabase.functions.invoke("wisely-ai")` for responses
- ReactMarkdown rendering for responses
- Auto-fetches context on open/route change
- Minimize/maximize/close controls
- Page-specific suggestion chips

### 2. `src/layouts/AdminLayout.tsx`
- Import and render `<WiselyChat />` before closing `</div>`

### 3. `supabase/functions/wisely-ai/index.ts`
- Replace `SYSTEM_PROMPT` with the expanded version (includes strategic mode, property details, income breakdown, wedding plans)

### 4. `src/pages/DashboardPage.tsx` (line 166)
- Remove `<GoldButton><Sparkles className="w-4 h-4" /> Wisely</GoldButton>`
- Keep the WiselyDashboardCard (analysis card) — it's a different feature

## Files Changed
| File | Action |
|------|--------|
| `src/components/wt7/WiselyChat.tsx` | Create — floating chat component |
| `src/layouts/AdminLayout.tsx` | Add `<WiselyChat />` |
| `supabase/functions/wisely-ai/index.ts` | Update system prompt |
| `src/pages/DashboardPage.tsx` | Remove Wisely button (line 166) |

