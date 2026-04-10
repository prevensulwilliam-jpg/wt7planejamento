

# Naval — Análise de Conciliação após importação OFX

## O que será feito

Após importação bem-sucedida do extrato na `ImportTab`, chamar automaticamente a edge function `wisely-ai` com `action: "reconcile"`, passando transações pendentes do mês, receitas esperadas e kitnet_entries. O resultado será exibido numa `PremiumCard` abaixo da área de upload.

## Mudanças (arquivo único: `src/pages/ReconciliationPage.tsx`)

### 1. Adicionar estados na ImportTab
- `navalAnalysis: string | null` — texto retornado pelo Naval
- `navalLoading: boolean` — loading state durante a chamada

### 2. Após importação bem-sucedida, chamar wisely-ai
No final do `doImport` (após o toast.success), buscar:
- Transações pendentes do mês via `supabase.from("bank_transactions").select("*").in("status", ["pending","auto_categorized"]).gte/lte(date, mês)`
- Receitas esperadas via `supabase.from("revenues").select("*").eq("reference_month", mês)`
- Kitnet entries via `supabase.from("kitnet_entries").select("*").eq("reference_month", mês)`

Então invocar:
```typescript
const { data } = await supabase.functions.invoke("wisely-ai", {
  body: { action: "reconcile", month, pendingTransactions, expectedRevenues, kitnetEntries }
});
setNavalAnalysis(data?.text ?? null);
```

### 3. Renderizar PremiumCard com resultado
Abaixo do Accordion de instruções (após linha ~516), adicionar:
```tsx
{(navalLoading || navalAnalysis) && (
  <PremiumCard className="mt-6 lg:col-span-2" glowColor="#C9A84C">
    <h2>🧭 Naval — Análise de Conciliação</h2>
    {navalLoading ? <Skeleton /> : <div>{navalAnalysis formatado}</div>}
  </PremiumCard>
)}
```

O texto será renderizado com formatação markdown simples (split por `**` para negrito, `##` para headings).

### 4. Ajuste de layout
A PremiumCard do Naval ficará fora do grid `lg:grid-cols-2`, ocupando largura total abaixo dos dois cards existentes. Para isso, reestruturar o return da ImportTab para ter o grid dos 2 cards + a PremiumCard do Naval como irmão abaixo.

