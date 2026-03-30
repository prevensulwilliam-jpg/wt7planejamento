

# Fix crítico — 4 bugs na conciliação bancária

## Resumo
Corrigir parser OFX para valores com vírgula decimal, adicionar keywords Credifoz/Ailos, prevenir duplicação de receitas/despesas na conciliação, e criar funções SQL para limpar duplicatas existentes.

## 1. `src/lib/parseOFX.ts` — Parser de vírgula decimal

Linha 23: substituir o parse simples do TRNAMT por lógica que trata ponto de milhar + vírgula decimal (formato BR como `10.050,00`).

## 2. `src/lib/categorizeTransaction.ts` — Keywords Credifoz/Ailos

- Adicionar ao `TRANSFER_KEYWORDS`: `db.apl.rdcpos`, `cr.apl.rdcpos`, `db. cotas`, `cr.dep.interc`, `cr.trf.interc`, `db.trf.interc`, `apl.rdcpos`, `rdcpos`, `credito pix - william tavares`, `debito pix - william tavares`, `camila fuenfstueck adriano`
- Adicionar ao `EXPENSE_RULES`: Internet/Telefonia (claro, tim, vivo, oi), Energia Elétrica (celesc distribuicao), Facebook/Google Ads, Conveniências
- Adicionar ao `CATEGORY_LABELS`: `internet`, `energia_eletrica`

## 3. `src/pages/ReconciliationPage.tsx` — Anti-duplicata

### 3a. `classifyAs` (linhas 635-687)
Antes de inserir receita/despesa, verificar `tx.matched_revenue_id` / `tx.matched_expense_id`. Se já existe, apenas atualizar a categoria existente ao invés de criar nova.

### 3b. `recategorizeMutation` (linhas 494-566)
Adicionar check `!tx.matched_revenue_id` / `!tx.matched_expense_id` antes de inserir, linkando o ID de volta à transação.

### 3c. `confirmAllAuto` (linhas 689-736)
Mesmo check: verificar se já tem revenue/expense linkado antes de criar.

### 3d. Table action button (linha 945)
O botão Confirmar na tabela também precisa do check anti-duplicata — atualmente chama `matchMutation.mutate()` direto sem criar receita/despesa. Redirecionar para `classifyAs` para usar o fluxo completo.

## 4. Database — Funções de limpeza de duplicatas

Migration SQL com duas funções `SECURITY DEFINER`:
- `clean_duplicate_revenues()` — deleta receitas duplicadas (mesma description + reference_month + amount + source), mantém a mais antiga
- `clean_duplicate_expenses()` — deleta despesas duplicadas (mesma description + reference_month + amount + category), mantém a mais antiga

## 5. `src/pages/UsersPage.tsx` — Botão na zona de perigo

Adicionar botão "Limpar duplicatas" que chama as duas RPCs acima.

## Arquivos alterados
| Arquivo | Ação |
|---------|------|
| `src/lib/parseOFX.ts` | Fix parse vírgula decimal |
| `src/lib/categorizeTransaction.ts` | Add keywords Credifoz/Ailos + novas categorias |
| `src/pages/ReconciliationPage.tsx` | Anti-duplicata em classifyAs, recategorize, confirmAllAuto |
| DB migration | Funções clean_duplicate_revenues/expenses |
| `src/pages/UsersPage.tsx` | Botão limpar duplicatas na zona de perigo |

