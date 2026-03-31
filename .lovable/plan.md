

# Add user auth log at start of doImport

## Change in `src/pages/ReconciliationPage.tsx`

At **line 234** (right after `const doImport = async () => {`), insert:

```typescript
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Usuário logado:', {
      userId: user?.id,
      email: user?.email
    });
```

Single `getUser()` call stored in a variable to avoid calling it twice. No other changes needed.

## Files Changed
| File | Action |
|------|--------|
| `src/pages/ReconciliationPage.tsx` | Add user log at line 234 |

